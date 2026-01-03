from __future__ import annotations

import json
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, field_validator

from .import_utils import (
    ImportedIngredient,
    ImportedRecipe,
    clean_text,
    ensure_domain,
    get_openai_client,
    instructions_from_strings,
    sync_recipe_media_to_supabase,
)


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


def _fetch_instagram_metadata(instagram_url: str) -> dict[str, Any]:
    command = [
        "yt-dlp",
        "--dump-json",
        "--skip-download",
        instagram_url,
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            "Failed to fetch metadata from Instagram.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )

    metadata: Optional[dict[str, Any]] = None
    for line in reversed(result.stdout.splitlines()):
        line = line.strip()
        if not line:
            continue
        if not line.startswith("{"):
            continue
        try:
            metadata = json.loads(line)
            break
        except json.JSONDecodeError:
            continue

    return metadata or {}


def _openai_recipe_from_signals(
    instagram_url: str,
    metadata: dict[str, Any],
    caption_text: str,
) -> _InstagramRecipe:
    client = get_openai_client()
    payload = {
        "url": instagram_url,
        "metadata": {
            "title": metadata.get("title"),
            "description": metadata.get("description"),
            "uploader": metadata.get("uploader"),
            "uploader_id": metadata.get("uploader_id"),
            "uploader_url": metadata.get("uploader_url"),
            "tags": metadata.get("tags"),
            "duration": metadata.get("duration"),
            "like_count": metadata.get("like_count"),
        },
        "caption_text": caption_text,
    }
    system_prompt = (
        "You extract structured cooking recipes from Instagram reels/posts using metadata and captions. "
        "Return ONLY JSON that matches the provided schema. "
        "If any value is unknown, set it to null and list the field name inside missing_fields. "
        "Do not invent ingredients or instructions beyond what the source clearly describes."
    )

    response = client.responses.parse(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        text_format=_InstagramRecipe,
    )

    recipe = response.output_parsed
    recipe.source_url = instagram_url
    recipe.source_domain = ensure_domain(instagram_url)
    recipe.extracted_via = "yt-dlp+metadata+openai"
    return recipe


def _convert_recipe(recipe: _InstagramRecipe, thumbnail_url: Optional[str]) -> ImportedRecipe:
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

    return ImportedRecipe(
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
        media_video_url=None,
        media_local_path=None,
        media_image_url=thumbnail_url,
        ingredients=ingredients,
        instructions=instructions_from_strings(recipe.steps),
        tags=recipe.tags,
        metadata={
            "missingFields": recipe.missing_fields,
            "confidence": recipe.confidence,
        },
    )


def _extract_thumbnail_url(metadata: dict[str, Any]) -> Optional[str]:
    candidates: List[Optional[str]] = [
        metadata.get("thumbnail"),
        metadata.get("thumbnail_url"),
        metadata.get("thumbnailUrl"),
        metadata.get("thumbnail_large"),
    ]
    thumbnails = metadata.get("thumbnails") or metadata.get("thumbnail_list")
    if isinstance(thumbnails, list):
        for entry in thumbnails:
            if isinstance(entry, str):
                candidates.append(entry)
            elif isinstance(entry, dict):
                for key in ("url", "src"):
                    value = entry.get(key)
                    if isinstance(value, str):
                        candidates.append(value)
    for candidate in candidates:
        if isinstance(candidate, str):
            cleaned = candidate.strip()
            if cleaned:
                return cleaned
    return None


def import_instagram(url: str) -> Tuple[Dict[str, Any], Optional[str]]:
    metadata = _fetch_instagram_metadata(url)
    caption_text = metadata.get("description") or metadata.get("title") or ""
    recipe = _openai_recipe_from_signals(url, metadata, caption_text)
    thumbnail_url = _extract_thumbnail_url(metadata)
    converted = _convert_recipe(recipe, thumbnail_url)
    sync_recipe_media_to_supabase(converted)
    return converted.model_dump_recipe(), None
