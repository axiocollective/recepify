from __future__ import annotations

import base64
import io
import logging
import mimetypes
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator

from ..config import get_settings
from .import_utils import (
    ImportedIngredient,
    ImportedRecipe,
    clean_text,
    ensure_storage_path,
    get_openai_client,
    instructions_from_strings,
    sync_recipe_media_to_supabase,
)


logger = logging.getLogger(__name__)
_SETTINGS = get_settings()


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


class _ScannedRecipe(BaseModel):
    title: str
    description: Optional[str] = None
    servings: Optional[str] = None
    time_total: Optional[str] = None
    time_prep: Optional[str] = None
    time_cook: Optional[str] = None
    ingredients: List[_IngredientLine] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)
    confidence: Optional[float] = None


def _guess_extension(filename: Optional[str], content_type: Optional[str]) -> str:
    if filename:
        ext = Path(filename).suffix
        if ext:
            return ext
    if content_type:
        mime = content_type.split(";")[0].strip()
        guess = mimetypes.guess_extension(mime)
        if guess:
            return guess
    return ".jpg"


def _save_image(data: bytes, filename: Optional[str], content_type: Optional[str]) -> Path:
    ext = _guess_extension(filename, content_type)
    target_dir = ensure_storage_path("scan", is_file=False)
    output_path = target_dir / f"scan_{uuid.uuid4().hex[:10]}{ext}"
    output_path.write_bytes(data)
    return output_path


def _preprocess_image(data: bytes) -> bytes:
    if not data:
        raise RuntimeError("Uploaded image is empty.")
    try:
        with Image.open(io.BytesIO(data)) as uploaded:
            image = ImageOps.exif_transpose(uploaded)
            max_edge = _SETTINGS.scan_max_image_edge
            width, height = image.size
            if max(width, height) > max_edge:
                ratio = max_edge / float(max(width, height))
                new_size = (int(width * ratio), int(height * ratio))
                resample_source = getattr(Image, "Resampling", Image)
                resample = getattr(resample_source, "LANCZOS", Image.LANCZOS)
                image = image.resize(new_size, resample)
            if image.mode not in {"RGB", "L"}:
                image = image.convert("RGB")
            buffer = io.BytesIO()
            image.save(
                buffer,
                format="JPEG",
                quality=_SETTINGS.scan_jpeg_quality,
                progressive=True,
                optimize=True,
            )
        return buffer.getvalue()
    except Exception as exc:  # pragma: no cover - defensive
        raise RuntimeError("Failed to preprocess uploaded image.") from exc


def _call_google_vision(image_data: bytes) -> str:
    api_key = _SETTINGS.google_vision_api_key
    if not api_key:
        raise RuntimeError("GOOGLE_VISION_API_KEY is not configured.")
    encoded = base64.b64encode(image_data).decode("ascii")
    payload = {
        "requests": [
            {
                "image": {"content": encoded},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }
    url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, json=payload)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - network
            raise RuntimeError(f"Google Vision request failed: {exc.response.text or exc}") from exc
        data = response.json()
    raw_text = data.get("responses", [{}])[0].get("fullTextAnnotation", {}).get("text") or ""
    return raw_text.strip()


def _openai_recipe_from_text(raw_text: str, model_override: Optional[str] = None) -> _ScannedRecipe:
    if not raw_text.strip():
        raise RuntimeError("Google Vision returned no text. Try a clearer photo.")
    client = get_openai_client()
    system_prompt = (
        "You are an expert culinary editor. Convert the OCR text from a scanned recipe into the structured schema. "
        "Preserve ingredient measurements and step ordering. "
        "If a field is missing, set it to null and list it in missing_fields."
    )
    response = client.responses.parse(
        model=model_override or _SETTINGS.scan_vision_model,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"OCR TEXT:\n{raw_text}"},
        ],
        text_format=_ScannedRecipe,
        **({"max_output_tokens": _SETTINGS.scan_max_output_tokens} if _SETTINGS.scan_max_output_tokens else {}),
    )
    return response.output_parsed


def _openai_recipe_with_fallback_from_text(raw_text: str) -> _ScannedRecipe:
    try:
        return _openai_recipe_from_text(raw_text)
    except Exception as exc:
        if _SETTINGS.scan_fallback_model:
            logger.warning("Primary OpenAI parsing failed (%s). Trying fallback model.", exc)
            return _openai_recipe_from_text(raw_text, model_override=_SETTINGS.scan_fallback_model)
        raise


def _convert_recipe(recipe: _ScannedRecipe, image_path: Path) -> ImportedRecipe:
    ingredients: List[ImportedIngredient] = []
    for item in recipe.ingredients:
        line = clean_text(f"{item.amount or ''} {item.name}".strip())
        if not line:
            continue
        ingredients.append(
            ImportedIngredient(
                line=line,
                amount=item.amount,
                name=item.name,
            )
        )

    return ImportedRecipe(
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        total_time=recipe.time_total,
        prep_time=recipe.time_prep,
        cook_time=recipe.time_cook,
        source_platform="scan",
        source_url="scan://local",
        source_domain="scan",
        extracted_via="scan+google-vision+openai",
        media_video_url=None,
        media_local_path=str(image_path),
        media_image_url=str(image_path),
        ingredients=ingredients,
        instructions=instructions_from_strings(recipe.steps),
        tags=[],
        metadata={
            "missingFields": recipe.missing_fields,
            "confidence": recipe.confidence,
        },
    )


def import_scan(image_bytes: bytes, filename: Optional[str], content_type: Optional[str]) -> Dict[str, Any]:
    optimized = _preprocess_image(image_bytes)
    image_path = _save_image(optimized, filename, "image/jpeg")
    raw_text = _call_google_vision(optimized)
    recipe = _openai_recipe_with_fallback_from_text(raw_text)
    converted = _convert_recipe(recipe, image_path)
    converted.metadata["rawText"] = raw_text
    converted.metadata["extractedBy"] = "google-vision+openai"
    sync_recipe_media_to_supabase(converted)
    return converted.model_dump_recipe()
