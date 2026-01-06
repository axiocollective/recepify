from __future__ import annotations

import json
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import httpx
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


class _TikTokRecipe(BaseModel):
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
    source_platform: str = "tiktok"
    extracted_via: str

    missing_fields: List[str] = Field(default_factory=list)
    confidence: Optional[float] = None


def _fetch_tiktok_oembed(tiktok_url: str) -> dict[str, Any]:
    endpoint = f"https://www.tiktok.com/oembed?url={quote(tiktok_url, safe='')}"
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
    except Exception as exc:  # pragma: no cover - networking is handled at runtime
        return {"_error": str(exc)}


def _download_tiktok_video(tiktok_url: str) -> Path:
    target_dir = ensure_storage_path("tiktok", is_file=False)
    file_id = uuid.uuid4().hex[:8]
    output_template = target_dir / f"tiktok_{file_id}.%(ext)s"

    yt_dlp_cmd = shutil.which("yt-dlp")
    base_cmd = [yt_dlp_cmd] if yt_dlp_cmd else [sys.executable, "-m", "yt_dlp"]
    command = base_cmd + [
        "-f",
        "bv*+ba/best",
        "--no-playlist",
        "--restrict-filenames",
        "-o",
        str(output_template),
        tiktok_url,
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            "yt-dlp failed to download the TikTok video.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )

    candidates = sorted(
        target_dir.glob(f"tiktok_{file_id}.*"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise RuntimeError("Download reported success but file was not found.")
    return candidates[0]


def _extract_audio(video_path: Path) -> Path:
    audio_dir = ensure_storage_path("tiktok", "audio", is_file=False)
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
    except FileNotFoundError as exc:
        raise RuntimeError(
            "ffmpeg is required to process TikTok videos but was not found. "
            "Install ffmpeg (e.g. `brew install ffmpeg`) and restart the backend."
        ) from exc
    if result.returncode != 0:
        raise RuntimeError(
            "ffmpeg failed to extract audio from the TikTok video.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
    return output_path


def _capture_thumbnail(video_path: Path) -> Path:
    thumb_dir = ensure_storage_path("tiktok", "thumbnails", is_file=False)
    output_path = thumb_dir / f"thumb_{uuid.uuid4().hex[:8]}.jpg"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-ss",
        "00:00:01.000",
        "-vframes",
        "1",
        str(output_path),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(
            "ffmpeg is required to capture thumbnails but was not found. "
            "Install ffmpeg (e.g. `brew install ffmpeg`) and restart the backend."
        ) from exc
    if result.returncode != 0:
        raise RuntimeError(
            "ffmpeg failed to capture a thumbnail from the TikTok video.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
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
        return None
    if result.returncode != 0:
        return None
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def _openai_recipe_from_signals(
    tiktok_url: str,
    oembed: dict[str, Any],
    transcript: str,
) -> tuple[_TikTokRecipe, Dict[str, Any]]:
    client = get_openai_client()
    payload = {
        "url": tiktok_url,
        "oembed_title": oembed.get("title"),
        "oembed_author": oembed.get("author_name"),
        "oembed_provider": oembed.get("provider_name"),
        "oembed_raw": {k: v for k, v in oembed.items() if k != "html"},
        "transcript": transcript,
    }
    system_prompt = (
        "You extract cooking recipes from TikTok metadata and audio transcripts. "
        "Return ONLY JSON that matches the provided schema. "
        "If a value is unknown set it to null and list the field inside missing_fields. "
        "Do not invent extra steps or ingredients beyond what the transcript/title clearly implies."
    )

    response = client.responses.parse(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        text_format=_TikTokRecipe,
    )
    usage = extract_openai_usage(response)
    usage_event = build_usage_event(
        "openai",
        model="gpt-4o-mini",
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        total_tokens=usage["total_tokens"],
        stage="tiktok_openai",
    )

    recipe = response.output_parsed
    recipe.source_url = tiktok_url
    recipe.source_domain = ensure_domain(tiktok_url)
    recipe.extracted_via = "yt-dlp+whisper+openai"
    return recipe, usage_event


def _convert_recipe(
    recipe: _TikTokRecipe,
    video_path: Path,
    thumbnail_path: Path,
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
        source_platform="tiktok",
        source_url=recipe.source_url,
        source_domain=recipe.source_domain,
        extracted_via=recipe.extracted_via,
        media_video_url=str(video_path),
        media_local_path=str(video_path),
        media_image_url=str(thumbnail_path),
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


def import_tiktok(url: str) -> Tuple[Dict[str, Any], str]:
    oembed = _fetch_tiktok_oembed(url)
    video_path = _download_tiktok_video(url)
    thumbnail_path = _capture_thumbnail(video_path)
    audio_path = _extract_audio(video_path)
    transcript = _transcribe_audio(audio_path)
    whisper_event = None
    audio_seconds = _get_audio_duration_seconds(audio_path)
    if audio_seconds:
        whisper_event = build_usage_event(
            "openai",
            model="whisper-1",
            stage="tiktok_whisper",
            extra={"audio_seconds": round(audio_seconds, 3)},
        )
    recipe, usage_event = _openai_recipe_from_signals(url, oembed, transcript)
    usage_events = [usage_event]
    if whisper_event:
        usage_events.append(whisper_event)
    converted = _convert_recipe(recipe, video_path, thumbnail_path, usage_events)
    sync_recipe_media_to_supabase(converted)
    return converted.model_dump_recipe(), converted.media_video_url or str(video_path)
