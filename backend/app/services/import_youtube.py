from __future__ import annotations

import json
import re
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
)

MAX_VIDEO_MINUTES_NO_DESC = 15
MAX_TEXT_TO_LLM_CHARS = 20000
MAX_SUBTITLES_CHARS = 14000
MAX_TRANSCRIPT_CHARS = 12000
WHISPER_CHUNKS = [(0, 90), (90, 90), (300, 90), (600, 90)]
WHISPER_MAX_TOTAL_SECONDS = 240

UNIT_WORDS = [
    "g",
    "kg",
    "ml",
    "l",
    "el",
    "tl",
    "tbsp",
    "tsp",
    "cup",
    "cups",
    "oz",
    "lb",
    "prise",
    "pinch",
    "stück",
    "stk",
    "scheiben",
    "cl",
    "dl",
]
STEP_MARKERS = [
    "step",
    "schritt",
    "zubereitung",
    "methode",
    "method",
    "instructions",
    "anleitung",
]


class _IngredientLine(BaseModel):
    name: str
    amount: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def no_zero_amount(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (int, float)) and value == 0:
            return None
        if isinstance(value, str) and value.strip() in {"0", "0.0", "0,0"}:
            return None
        return value


class _YouTubeRecipe(BaseModel):
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
    source_platform: str = "youtube"
    extracted_via: str

    missing_fields: List[str] = Field(default_factory=list)
    confidence: Optional[float] = None


def _clean_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _caption_has_ingredients(text: str) -> bool:
    if not text:
        return False
    lines = [line.strip() for line in re.split(r"[\n\r]+", text) if line.strip()]
    hits = 0
    for line in lines:
        low = line.lower()
        has_number = bool(re.search(r"\d", line))
        has_unit = any(unit in low for unit in UNIT_WORDS)
        if has_number and has_unit:
            hits += 1
    return hits >= 2


def _caption_has_steps(text: str) -> bool:
    if not text:
        return False
    low = text.lower()
    if re.search(r"(^|\n)\s*(step|schritt)\s*\d", low):
        return True
    if re.search(r"(^|\n)\s*\d+\s*[\).\:-]\s+\w+", text):
        return True
    if any(marker in low for marker in STEP_MARKERS):
        verbs = [
            "mix",
            "stir",
            "bake",
            "cook",
            "add",
            "preheat",
            "simmer",
            "whisk",
            "fold",
            "serve",
            "vermischen",
            "rühren",
            "backen",
            "kochen",
            "zugeben",
            "vorheizen",
            "köcheln",
            "servieren",
        ]
        hits = sum(1 for verb in verbs if verb in low)
        return hits >= 2
    verbs = [
        "mix",
        "stir",
        "bake",
        "cook",
        "add",
        "preheat",
        "simmer",
        "whisk",
        "fold",
        "serve",
        "vermischen",
        "rühren",
        "backen",
        "kochen",
        "zugeben",
        "vorheizen",
        "köcheln",
        "servieren",
    ]
    hits = sum(1 for verb in verbs if verb in low)
    return hits >= 4


def _fetch_youtube_oembed(youtube_url: str) -> dict[str, Any]:
    endpoint = f"https://www.youtube.com/oembed?url={quote(youtube_url, safe='')}&format=json"
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
    except Exception as exc:  # pragma: no cover - runtime networking
        return {"_error": str(exc)}


def _yt_dlp_get_info(youtube_url: str) -> dict[str, Any]:
    yt_dlp_cmd = shutil.which("yt-dlp")
    base_cmd = [yt_dlp_cmd] if yt_dlp_cmd else [sys.executable, "-m", "yt_dlp"]
    command = base_cmd + ["-J", "--no-playlist", youtube_url]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        return {"_error": result.stderr.strip() or result.stdout.strip() or "yt-dlp -J failed"}
    try:
        return json.loads(result.stdout)
    except Exception as exc:
        return {"_error": f"Could not parse yt-dlp JSON: {exc}"}


def _yt_dlp_fetch_subtitles_text(
    youtube_url: str,
    langs: List[str] | None = None,
) -> Tuple[str, str]:
    target_dir = ensure_storage_path("youtube", "subtitles", is_file=False)
    file_id = uuid.uuid4().hex[:8]
    out_tpl = target_dir / f"subs_{file_id}.%(ext)s"
    languages = langs or ["en", "de"]

    yt_dlp_cmd = shutil.which("yt-dlp")
    base_cmd = [yt_dlp_cmd] if yt_dlp_cmd else [sys.executable, "-m", "yt_dlp"]

    def run_cmd(write_auto: bool) -> Optional[Path]:
        command = base_cmd + [
            "--skip-download",
            "--no-playlist",
            "--sub-lang",
            ",".join(languages),
            "--write-subs" if not write_auto else "--write-auto-subs",
            "--sub-format",
            "vtt/srt",
            "-o",
            str(out_tpl),
            youtube_url,
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            return None
        candidates = [
            path
            for path in target_dir.glob(f"subs_{file_id}.*")
            if path.suffix in {".vtt", ".srt"}
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda path: path.stat().st_size, reverse=True)
        return candidates[0]

    def vtt_srt_to_text(path: Path) -> str:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        raw = re.sub(r"\d+\n", "", raw)
        raw = re.sub(r"\d{2}:\d{2}:\d{2}\.\d+\s+-->\s+\d{2}:\d{2}:\d{2}\.\d+.*\n", "", raw)
        raw = re.sub(r"\d{2}:\d{2}:\d{2},\d+\s+-->\s+\d{2}:\d{2}:\d{2},\d+.*\n", "", raw)
        raw = re.sub(r"<[^>]+>", "", raw)
        lines = [clean_text(line) for line in raw.splitlines()]
        lines = [line for line in lines if len(line) >= 2]
        return "\n".join(lines)

    subtitle_path = run_cmd(write_auto=False)
    if subtitle_path:
        return vtt_srt_to_text(subtitle_path)[:MAX_SUBTITLES_CHARS], "yt-dlp_subtitles"

    subtitle_path = run_cmd(write_auto=True)
    if subtitle_path:
        return vtt_srt_to_text(subtitle_path)[:MAX_SUBTITLES_CHARS], "yt-dlp_auto_subtitles"

    return "", ""


def _download_youtube_audio(youtube_url: str) -> Path:
    target_dir = ensure_storage_path("youtube", "audio", is_file=False)
    file_id = uuid.uuid4().hex[:8]
    out_tpl = target_dir / f"youtube_{file_id}.%(ext)s"

    yt_dlp_cmd = shutil.which("yt-dlp")
    base_cmd = [yt_dlp_cmd] if yt_dlp_cmd else [sys.executable, "-m", "yt_dlp"]
    command = base_cmd + [
        "--no-playlist",
        "--restrict-filenames",
        "-f",
        "bestaudio/best",
        "-o",
        str(out_tpl),
        youtube_url,
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            "yt-dlp failed to download the YouTube audio.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
    candidates = sorted(
        target_dir.glob(f"youtube_{file_id}.*"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise RuntimeError("Download reported success but file was not found.")
    return candidates[0]


def _trim_audio_segment(audio_path: Path, start_s: int, duration_s: int) -> Path:
    seg_dir = ensure_storage_path("youtube", "segments", is_file=False)
    seg_path = seg_dir / f"seg_{uuid.uuid4().hex[:8]}.mp3"
    command = [
        "ffmpeg",
        "-y",
        "-ss",
        str(start_s),
        "-t",
        str(duration_s),
        "-i",
        str(audio_path),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(seg_path),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(
            "ffmpeg is required to process YouTube audio but was not found. "
            "Install ffmpeg (e.g. `brew install ffmpeg`) and restart the backend."
        ) from exc
    if result.returncode != 0:
        raise RuntimeError(
            "ffmpeg failed to trim the YouTube audio.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )
    return seg_path


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


def _openai_extract_steps_only(
    youtube_url: str,
    title: Optional[str],
    description: str,
    transcript_text: str,
    model: str = "gpt-4o-mini",
) -> List[str]:
    client = get_openai_client()
    system_msg = (
        "Extract ONLY the cooking steps as a numbered list from the given transcript/captions. "
        "Do not add ingredients. Do not invent steps. "
        "Return ONLY JSON: {\"steps\": [\"...\"]} with short actionable steps."
    )
    payload = {
        "url": youtube_url,
        "title": title,
        "description": description[:6000],
        "transcript_or_subs": transcript_text[:MAX_TRANSCRIPT_CHARS],
    }
    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    )
    raw = response.output_text
    try:
        parsed = json.loads(raw)
        steps = parsed.get("steps") or []
        return [clean_text(step) for step in steps if clean_text(step)]
    except Exception:
        steps: List[str] = []
        for line in raw.splitlines():
            cleaned = re.sub(r"^\d+\s*[\).\:-]\s*", "", line).strip()
            if len(cleaned) >= 3:
                steps.append(clean_text(cleaned))
        return steps[:20]


def _openai_build_recipe(
    youtube_url: str,
    signals: Dict[str, Any],
    model: str = "gpt-4o-mini",
) -> _YouTubeRecipe:
    client = get_openai_client()
    system_msg = (
        "You extract cooking recipes from YouTube signals. "
        "Return ONLY a JSON object matching the schema exactly. "
        "Do not invent ingredients or steps. "
        "If ingredients exist in description, use them. "
        "If steps_override is provided, use it as steps. "
        "Ingredients must be list of {name, amount} objects; amount null if unknown. "
        "Steps must be short actionable strings."
    )
    response = client.responses.parse(
        model=model,
        input=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": json.dumps(signals, ensure_ascii=False)[:MAX_TEXT_TO_LLM_CHARS]},
        ],
        text_format=_YouTubeRecipe,
    )
    recipe = response.output_parsed
    recipe.source_url = youtube_url
    recipe.source_domain = ensure_domain(youtube_url)
    recipe.source_platform = "youtube"
    return recipe


def _convert_recipe(
    recipe: _YouTubeRecipe,
    disclaimer: Optional[str],
    thumbnail_url: Optional[str],
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

    metadata: Dict[str, Any] = {
        "missingFields": recipe.missing_fields,
        "confidence": recipe.confidence,
    }
    if disclaimer:
        metadata["disclaimer"] = disclaimer

    return ImportedRecipe(
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        total_time=recipe.time_total,
        prep_time=recipe.time_prep,
        cook_time=recipe.time_cook,
        source_platform="youtube",
        source_url=recipe.source_url,
        source_domain=recipe.source_domain,
        extracted_via=recipe.extracted_via,
        media_video_url=None,
        media_local_path=None,
        media_image_url=thumbnail_url,
        ingredients=ingredients,
        instructions=instructions_from_strings(recipe.steps),
        tags=[],
        metadata=metadata,
    )


def import_youtube(url: str) -> Dict[str, Any]:
    oembed = _fetch_youtube_oembed(url)
    yinfo = _yt_dlp_get_info(url)

    title = None
    author = None
    duration_s = None
    description = ""
    thumbnail_url = None

    if "_error" not in (oembed or {}):
        title = oembed.get("title")
        author = oembed.get("author_name")
        thumbnail_url = oembed.get("thumbnail_url") or oembed.get("thumbnail") or thumbnail_url

    if "_error" not in (yinfo or {}):
        duration_s = yinfo.get("duration")
        description = yinfo.get("description") or ""
        title = title or yinfo.get("title")
        author = author or yinfo.get("uploader") or yinfo.get("channel")
        thumbnail_url = thumbnail_url or yinfo.get("thumbnail")
        if not thumbnail_url and isinstance(yinfo.get("thumbnails"), list):
            for candidate in reversed(yinfo["thumbnails"]):
                if isinstance(candidate, dict) and candidate.get("url"):
                    thumbnail_url = str(candidate["url"])
                    break

    duration_min = (duration_s / 60) if duration_s else None
    ing_ok = _caption_has_ingredients(description)
    steps_ok = _caption_has_steps(description)

    if duration_min and duration_min > MAX_VIDEO_MINUTES_NO_DESC and len(_clean_ws(description)) < 80 and not ing_ok:
        raise ValueError("YOUTUBE_TOO_LONG_NO_DESC")

    if ing_ok and steps_ok:
        signals = {
            "title": title,
            "description": description[:30000],
            "author": author,
            "duration_seconds": duration_s,
            "steps_override": None,
            "subtitles_or_transcript": "",
        }
        recipe = _openai_build_recipe(url, signals)
        recipe.extracted_via = "description_only+openai"
        return _convert_recipe(recipe, disclaimer=None, thumbnail_url=thumbnail_url).model_dump_recipe()

    if ing_ok and not steps_ok:
        steps_override: List[str] = []
        subs_text, subs_via = _yt_dlp_fetch_subtitles_text(url)
        if subs_text:
            steps_override = _openai_extract_steps_only(url, title, description, subs_text)

        transcript_text = ""
        if len(steps_override) < 4:
            audio_path = _download_youtube_audio(url)
            used = 0
            chunks_collected: List[str] = []
            for (start_s, dur_s) in WHISPER_CHUNKS:
                if used + dur_s > WHISPER_MAX_TOTAL_SECONDS:
                    break
                try:
                    seg = _trim_audio_segment(audio_path, start_s, dur_s)
                    transcript = _clean_ws(_transcribe_audio(seg))
                    if transcript:
                        chunks_collected.append(f"[{start_s}-{start_s + dur_s}s] {transcript}")
                        used += dur_s
                        transcript_text = "\n".join(chunks_collected)
                        steps_try = _openai_extract_steps_only(url, title, description, transcript_text)
                        steps_override = steps_try
                        if len(steps_override) >= 6:
                            break
                except Exception:
                    continue

        disclaimer = None
        if len(steps_override) < 4:
            disclaimer = (
                "Ingredients were found in the description, but steps could not be reliably extracted "
                "within the cost-safe transcription budget."
            )

        signals = {
            "title": title,
            "description": description[:30000],
            "author": author,
            "duration_seconds": duration_s,
            "steps_override": steps_override,
            "subtitles_or_transcript": (subs_text or transcript_text)[:MAX_TRANSCRIPT_CHARS],
        }
        recipe = _openai_build_recipe(url, signals)
        if subs_text and len(steps_override) >= 4:
            recipe.extracted_via = f"{subs_via}+steps_rescue+openai"
        elif len(steps_override) >= 4:
            recipe.extracted_via = "whisper_steps_rescue+openai"
        else:
            recipe.extracted_via = "steps_rescue_partial+openai"
        return _convert_recipe(recipe, disclaimer=disclaimer, thumbnail_url=thumbnail_url).model_dump_recipe()

    subs_text, subs_via = _yt_dlp_fetch_subtitles_text(url)
    transcript_text = subs_text
    if not subs_text:
        audio_path = _download_youtube_audio(url)
        used = 0
        chunks_collected: List[str] = []
        for (start_s, dur_s) in WHISPER_CHUNKS:
            if used + dur_s > WHISPER_MAX_TOTAL_SECONDS:
                break
            try:
                seg = _trim_audio_segment(audio_path, start_s, dur_s)
                transcript = _clean_ws(_transcribe_audio(seg))
                if transcript:
                    chunks_collected.append(f"[{start_s}-{start_s + dur_s}s] {transcript}")
                    used += dur_s
            except Exception:
                continue
        transcript_text = "\n".join(chunks_collected)

    signals = {
        "title": title,
        "description": description[:30000],
        "author": author,
        "duration_seconds": duration_s,
        "steps_override": None,
        "subtitles_or_transcript": transcript_text[:MAX_TRANSCRIPT_CHARS],
    }
    recipe = _openai_build_recipe(url, signals)
    recipe.extracted_via = subs_via or "subtitles_or_whisper_chunks+openai"
    return _convert_recipe(recipe, disclaimer=None, thumbnail_url=thumbnail_url).model_dump_recipe()
