from __future__ import annotations

import json
import re
import os
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field, field_validator

from .import_utils import (
    ImportedIngredient,
    ImportedRecipe,
    clean_text,
    ensure_domain,
    ensure_storage_path,
    get_openai_client,
    instructions_from_strings,
    sync_recipe_media_to_supabase,
)
from .usage_utils import append_usage_event, build_usage_event, extract_openai_usage


class _IngredientLine(BaseModel):
    name: str
    amount: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def normalize_amount(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (int, float)) and value == 0:
            return None
        if isinstance(value, str) and value.strip() in {"0", "0.0", "0,0"}:
            return None
        return value


class _InstagramRecipe(BaseModel):
    title: str
    description: Optional[str] = None

    servings: Optional[str] = None
    time_total: Optional[str] = None
    time_prep: Optional[str] = None
    time_cook: Optional[str] = None

    ingredients: List[_IngredientLine]
    steps: List[str]
    tags: List[str] = Field(default_factory=list)

    source_url: str
    source_domain: str
    source_platform: str = "instagram"
    extracted_via: str

    missing_fields: List[str] = Field(default_factory=list)
    confidence: Optional[float] = None


def _clean_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _fetch_instagram_oembed(instagram_url: str) -> dict[str, Any]:
    endpoint = f"https://api.instagram.com/oembed/?url={quote(instagram_url, safe='')}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "de,en;q=0.8",
    }
    try:
        with httpx.Client(headers=headers, timeout=20.0, follow_redirects=True) as client:
            response = client.get(endpoint)
            response.raise_for_status()
            return response.json()
    except Exception as exc:
        return {"_error": str(exc)}


def _download_instagram_video(instagram_url: str) -> Optional[Path]:
    target_dir = ensure_storage_path("instagram", is_file=False)
    file_id = uuid.uuid4().hex[:8]
    output_template = target_dir / f"instagram_{file_id}.%(ext)s"

    yt_dlp_cmd = shutil.which("yt-dlp")
    base_cmd = [yt_dlp_cmd] if yt_dlp_cmd else [sys.executable, "-m", "yt_dlp"]
    command = base_cmd + [
        "-f",
        "bv*+ba/best",
        "--no-playlist",
        "--restrict-filenames",
        "-o",
        str(output_template),
        instagram_url,
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        return None

    candidates = sorted(
        target_dir.glob(f"instagram_{file_id}.*"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def _extract_audio(video_path: Path) -> Optional[Path]:
    audio_dir = ensure_storage_path("instagram", "audio", is_file=False)
    output_path = audio_dir / f"audio_{uuid.uuid4().hex[:8]}.mp3"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(output_path),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True)
    except FileNotFoundError:
        return None
    if result.returncode != 0:
        return None
    return output_path


def _transcribe_audio(audio_path: Path) -> str:
    client = get_openai_client()
    with audio_path.open("rb") as file_obj:
        transcript = client.audio.transcriptions.create(model="whisper-1", file=file_obj)
    text = getattr(transcript, "text", None)
    if text:
        return text
    if isinstance(transcript, dict):
        return transcript.get("text", "")
    return ""


def _get_audio_duration_seconds(audio_path: Path) -> Optional[float]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True)
    except FileNotFoundError:
        result = None
    if result.returncode != 0:
        result = None
    if result:
        try:
            return float(result.stdout.strip())
        except ValueError:
            pass
    # Fallback: parse ffmpeg output if ffprobe is unavailable.
    command = ["ffmpeg", "-i", str(audio_path)]
    try:
        fallback = subprocess.run(command, capture_output=True, text=True)
    except FileNotFoundError:
        return None
    match = re.search(r"Duration:\s(\d+):(\d+):(\d+\.?\d*)", fallback.stderr or "")
    if not match:
        return None
    try:
        hours = float(match.group(1))
        minutes = float(match.group(2))
        seconds = float(match.group(3))
    except ValueError:
        return None
    return hours * 3600 + minutes * 60 + seconds


def _html_meta(html: str) -> Dict[str, Optional[str]]:
    soup = BeautifulSoup(html, "html.parser")

    def meta(prop: Optional[str] = None, name: Optional[str] = None) -> Optional[str]:
        if prop:
            tag = soup.find("meta", attrs={"property": prop})
            return _clean_ws(tag.get("content")) if tag and tag.get("content") else None
        if name:
            tag = soup.find("meta", attrs={"name": name})
            return _clean_ws(tag.get("content")) if tag and tag.get("content") else None
        return None

    title_tag = soup.title.get_text(strip=True) if soup.title else None
    return {
        "title_tag": _clean_ws(title_tag) if title_tag else None,
        "og_title": meta(prop="og:title"),
        "og_description": meta(prop="og:description"),
        "og_image": meta(prop="og:image"),
        "og_url": meta(prop="og:url"),
        "meta_description": meta(name="description"),
    }


def _playwright_rescue(instagram_url: str) -> Dict[str, Any]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return {"meta": {}, "caption_text": None, "screenshot_path": None}

    screenshot_dir = ensure_storage_path("instagram", "screenshots", is_file=False)
    screenshot_path = screenshot_dir / f"ig_{uuid.uuid4().hex[:8]}.png"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="de-DE",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        page.goto(instagram_url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(2500)

        for selector in (
            "button:has-text('Alle Cookies erlauben')",
            "button:has-text('Alle akzeptieren')",
            "button:has-text('Akzeptieren')",
            "button:has-text('Allow all cookies')",
            "button:has-text('Accept all')",
            "button:has-text('Accept')",
        ):
            try:
                locator = page.locator(selector).first
                if locator.is_visible(timeout=1200):
                    locator.click(timeout=1200)
                    page.wait_for_timeout(1500)
                    break
            except Exception:
                continue

        page.wait_for_timeout(3500)

        screenshot_file: Optional[Path] = None
        try:
            page.screenshot(path=str(screenshot_path), full_page=False)
            screenshot_file = screenshot_path
        except Exception:
            screenshot_file = None

        rendered_html = page.content()
        meta = _html_meta(rendered_html)

        caption_texts: List[str] = []
        try:
            article = page.locator("article").first
            if article.count() > 0:
                text = _clean_ws(article.inner_text())
                if text:
                    caption_texts.append(text)
        except Exception:
            pass

        if meta.get("og_description"):
            caption_texts.append(meta["og_description"])
        if meta.get("meta_description"):
            caption_texts.append(meta["meta_description"])

        best_caption = None
        if caption_texts:
            dedup: List[str] = []
            seen = set()
            for text in caption_texts:
                cleaned = _clean_ws(text)
                if cleaned and cleaned not in seen:
                    seen.add(cleaned)
                    dedup.append(cleaned)
            dedup.sort(key=len, reverse=True)
            best_caption = dedup[0][:8000] if dedup else None

        context.close()
        browser.close()

    return {
        "meta": meta,
        "caption_text": best_caption,
        "screenshot_path": str(screenshot_file) if screenshot_file else None,
    }


def _ocr_from_image(image_path: str) -> str:
    try:
        from PIL import Image
        import pytesseract

        if not shutil.which("tesseract"):
            return ""

        image = Image.open(image_path).convert("L")
        text = pytesseract.image_to_string(image)
        return _clean_ws(text)
    except Exception:
        return ""


def _openai_recipe_from_signals(
    instagram_url: str,
    oembed: dict[str, Any],
    rescue: dict[str, Any],
    transcript: Optional[str],
    ocr_text: Optional[str] = None,
) -> tuple[_InstagramRecipe, Dict[str, Any]]:
    client = get_openai_client()

    oembed_ok = "_error" not in (oembed or {})
    meta = (rescue or {}).get("meta") or {}
    caption_text = (rescue or {}).get("caption_text") or ""
    ocr_text = ocr_text or ""

    best_title = (
        (oembed.get("title") if oembed_ok else None)
        or meta.get("og_title")
        or meta.get("title_tag")
        or "Recipe from Instagram"
    )
    best_desc = (
        (meta.get("og_description") or meta.get("meta_description"))
        or (oembed.get("title") if oembed_ok else None)
    )
    thumb = (oembed.get("thumbnail_url") if oembed_ok else None) or meta.get("og_image")

    system_prompt = (
        "You extract cooking recipes from Instagram signals. "
        "Return ONLY JSON that matches the provided schema. "
        "If any value is unknown, set it to null and list the field name inside missing_fields. "
        "Never use 0 as a placeholder for unknown ingredient amounts. "
        "Do not invent ingredients or steps beyond what the signals clearly describe. "
        "Transcript has highest priority, OCR is helpful but may contain noise."
    )

    payload = {
        "url": instagram_url,
        "signals": {
            "title_best_effort": best_title,
            "description_best_effort": best_desc,
            "thumbnail_url_best_effort": thumb,
            "oembed_ok": oembed_ok,
            "oembed": {k: v for k, v in (oembed or {}).items() if k != "html"},
            "meta": meta,
            "caption_text": caption_text,
            "ocr_text": ocr_text,
            "transcript": transcript or "",
        },
    }

    response = client.responses.parse(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        text_format=_InstagramRecipe,
    )
    usage = extract_openai_usage(response)
    usage_event = build_usage_event(
        "openai",
        model="gpt-4o-mini",
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        total_tokens=usage["total_tokens"],
        stage="instagram_openai",
    )

    recipe = response.output_parsed
    recipe.source_url = instagram_url
    recipe.source_domain = ensure_domain(instagram_url)
    used: List[str] = []
    if transcript and transcript.strip():
        used.append("whisper")
    if oembed_ok:
        used.append("oembed")
    if caption_text.strip():
        used.append("playwright_caption")
    if meta.get("og_title") or meta.get("og_description"):
        used.append("og_meta")
    if ocr_text.strip():
        used.append("ocr")
    recipe.extracted_via = "+".join(used) if used else "openai_no_signals"
    return recipe, usage_event


def _needs_ocr(recipe: _InstagramRecipe) -> bool:
    return len(recipe.ingredients) == 0 or len(recipe.steps) == 0


def _convert_recipe(
    recipe: _InstagramRecipe,
    thumbnail_url: Optional[str],
    video_path: Optional[Path],
    usage_events: Optional[List[Dict[str, Any]]] = None,
) -> ImportedRecipe:
    ingredients: List[ImportedIngredient] = []
    for item in recipe.ingredients:
        base_line = clean_text(f"{item.amount or ''} {item.name}".strip())
        if not base_line:
            continue
        ingredients.append(
            ImportedIngredient(
                line=base_line,
                amount=item.amount,
                name=item.name,
            )
        )

    converted = ImportedRecipe(
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        total_time=recipe.time_total,
        prep_time=recipe.time_prep,
        cook_time=recipe.time_cook,
        source_platform="instagram",
        source_url=recipe.source_url,
        source_domain=recipe.source_domain,
        extracted_via=recipe.extracted_via,
        media_video_url=str(video_path) if video_path else None,
        media_local_path=str(video_path) if video_path else None,
        media_image_url=thumbnail_url,
        ingredients=ingredients,
        instructions=instructions_from_strings(recipe.steps),
        tags=[],
        metadata={
            "missingFields": recipe.missing_fields,
            "confidence": recipe.confidence,
        },
    )
    if usage_events:
        for event in usage_events:
            append_usage_event(converted.metadata, event)
    return converted


def import_instagram(url: str) -> Tuple[Dict[str, Any], Optional[str]]:
    oembed = _fetch_instagram_oembed(url)

    transcript: Optional[str] = None
    whisper_event: Optional[Dict[str, Any]] = None
    video_path = _download_instagram_video(url)
    if video_path:
        audio_path = _extract_audio(video_path)
        if audio_path:
            transcript = _transcribe_audio(audio_path)
            audio_seconds = _get_audio_duration_seconds(audio_path)
            if audio_seconds:
                whisper_event = build_usage_event(
                    "openai",
                    model="whisper-1",
                    stage="instagram_whisper",
                    extra={"audio_seconds": round(audio_seconds, 3)},
                )

    rescue = _playwright_rescue(url)
    usage_events: List[Dict[str, Any]] = []
    if whisper_event:
        usage_events.append(whisper_event)
    recipe, usage_event = _openai_recipe_from_signals(
        instagram_url=url,
        oembed=oembed,
        rescue=rescue,
        transcript=transcript,
        ocr_text=None,
    )
    usage_events.append(usage_event)

    screenshot_path = rescue.get("screenshot_path")
    if _needs_ocr(recipe) and screenshot_path:
        ocr_text = _ocr_from_image(screenshot_path)
        if ocr_text:
            recipe_ocr, ocr_event = _openai_recipe_from_signals(
                instagram_url=url,
                oembed=oembed,
                rescue=rescue,
                transcript=transcript,
                ocr_text=ocr_text[:5000],
            )
            usage_events.append(ocr_event)
            if (len(recipe_ocr.ingredients) + len(recipe_ocr.steps)) > (
                len(recipe.ingredients) + len(recipe.steps)
            ):
                recipe = recipe_ocr

    thumbnail_url = (
        (oembed.get("thumbnail_url") if "_error" not in (oembed or {}) else None)
        or (rescue.get("meta") or {}).get("og_image")
    )

    converted = _convert_recipe(recipe, thumbnail_url, video_path, usage_events)
    sync_recipe_media_to_supabase(converted)
    return converted.model_dump_recipe(), str(video_path) if video_path else None
