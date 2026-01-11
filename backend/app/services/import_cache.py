from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import UUID, uuid4

from sqlmodel import Session, select

from ..models import GlobalRecipe
from .import_utils import clean_text, ensure_domain

logger = logging.getLogger(__name__)

QUALITY_MIN_SCORE = 70
FRESH_DAYS = 30
TRACKING_PARAMS = {
    "fbclid",
    "gclid",
    "igshid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
}


def normalize_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    query_params = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)]
    filtered = [(k, v) for k, v in query_params if k.lower() not in TRACKING_PARAMS and not k.lower().startswith("utm_")]
    normalized = parsed._replace(
        scheme=parsed.scheme.lower() or "https",
        netloc=parsed.netloc.lower(),
        path=parsed.path.rstrip("/") or "/",
        query=urlencode(filtered, doseq=True),
        fragment="",
    )
    return urlunparse(normalized)


def _normalize_text(value: Optional[str]) -> str:
    return clean_text(value or "").lower()


def _build_canonical_hash(recipe_data: Dict[str, Any]) -> str:
    title = _normalize_text(recipe_data.get("title"))
    ingredients = recipe_data.get("ingredients") or []
    instructions = recipe_data.get("instructions") or []
    ingredient_lines = [
        _normalize_text(item.get("line") or item.get("name") or "")
        for item in ingredients
        if isinstance(item, dict)
    ]
    instruction_lines = [
        _normalize_text(item.get("text") or "")
        for item in instructions
        if isinstance(item, dict)
    ]
    payload = "\n".join([title, *ingredient_lines, *instruction_lines])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _score_recipe(recipe_data: Dict[str, Any]) -> Tuple[int, bool, list[str]]:
    missing: list[str] = []
    ingredients = recipe_data.get("ingredients") or []
    instructions = recipe_data.get("instructions") or []
    title = clean_text(recipe_data.get("title"))
    description = clean_text(recipe_data.get("description"))

    score = 0
    if title:
        score += 10
    else:
        missing.append("title")
    if description:
        score += 10
    if ingredients:
        score += 35
    else:
        missing.append("ingredients")
    if instructions:
        score += 35
    else:
        missing.append("steps")
    if recipe_data.get("nutritionCalories"):
        score += 10

    is_complete = bool(ingredients and instructions)
    return score, is_complete, missing


def detect_language(recipe_data: Dict[str, Any]) -> str:
    parts = [
        recipe_data.get("title"),
        recipe_data.get("description"),
        " ".join([item.get("name", "") for item in recipe_data.get("ingredients") or [] if isinstance(item, dict)]),
        " ".join([item.get("text", "") for item in recipe_data.get("instructions") or [] if isinstance(item, dict)]),
    ]
    text = " ".join([clean_text(str(value)) for value in parts if value]).lower()
    if not text:
        return "en"

    german_indicators = [
        " und ",
        " mit ",
        " zutaten",
        " ofen",
        " pfanne",
        " minuten",
        " gramm",
        " el ",
        " tl ",
        " die ",
        " der ",
        " das ",
        " zubereitung",
    ]
    english_indicators = [
        " and ",
        " with ",
        " ingredients",
        " oven",
        " pan",
        " minutes",
        " tbsp",
        " tsp",
        " cups",
        " preheat",
        " bake",
        " serve",
    ]
    german_score = sum(1 for token in german_indicators if token in text)
    english_score = sum(1 for token in english_indicators if token in text)
    if any(char in text for char in ["ä", "ö", "ü", "ß"]):
        german_score += 2
    return "de" if german_score > english_score else "en"


def _is_better(new_score: int, new_complete: bool, existing: GlobalRecipe) -> bool:
    if existing.is_complete and not new_complete:
        return False
    if new_complete and not existing.is_complete:
        return True
    return new_score > existing.quality_score


def _should_reimport(existing: Optional[GlobalRecipe]) -> bool:
    if not existing:
        return True
    if not existing.is_complete:
        return True
    if existing.quality_score < QUALITY_MIN_SCORE:
        return True
    if not existing.last_fetched_at:
        return True
    last_fetched_at = existing.last_fetched_at
    if last_fetched_at.tzinfo is None:
        last_fetched_at = last_fetched_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - last_fetched_at > timedelta(days=FRESH_DAYS)


def _to_recipe_payload(global_recipe: GlobalRecipe) -> Dict[str, Any]:
    return {
        "title": global_recipe.title,
        "description": global_recipe.description,
        "mealType": global_recipe.meal_type,
        "difficulty": global_recipe.difficulty,
        "prepTime": global_recipe.prep_time,
        "cookTime": global_recipe.cook_time,
        "totalTime": global_recipe.total_time,
        "servings": global_recipe.servings,
        "nutritionCalories": global_recipe.nutrition_calories,
        "nutritionProtein": global_recipe.nutrition_protein,
        "nutritionCarbs": global_recipe.nutrition_carbs,
        "nutritionFat": global_recipe.nutrition_fat,
        "sourcePlatform": global_recipe.source_platform,
        "sourceUrl": global_recipe.source_url,
        "sourceDomain": global_recipe.source_domain,
        "mediaVideoUrl": global_recipe.media_video_url,
        "mediaImageUrl": global_recipe.media_image_url,
        "tags": global_recipe.tags or [],
        "ingredients": global_recipe.ingredients or [],
        "instructions": global_recipe.steps or [],
    }


def import_with_cache(
    session: Session,
    url: str,
    source: str,
    fetcher: Callable[[str], Tuple[Dict[str, Any], Optional[str]]],
) -> Tuple[Dict[str, Any], Optional[str], Optional[GlobalRecipe], bool, str]:
    normalized = normalize_url(url)
    existing = session.exec(
        select(GlobalRecipe)
        .where(GlobalRecipe.source_url_normalized == normalized)
        .where(GlobalRecipe.supersedes_id.is_(None))
        .order_by(GlobalRecipe.updated_at.desc())
    ).first()

    if existing and not _should_reimport(existing):
        return _to_recipe_payload(existing), None, existing, True, existing.language_code or "en"

    try:
        recipe_data, video_path = fetcher(url)
    except Exception as exc:
        if existing:
            logger.warning("Import failed, using cached recipe for %s: %s", url, exc)
            return _to_recipe_payload(existing), None, existing, True, existing.language_code or "en"
        raise

    score, is_complete, missing_fields = _score_recipe(recipe_data)
    language_code = detect_language(recipe_data)
    canonical_hash = _build_canonical_hash(recipe_data)
    canonical_group_id = existing.canonical_group_id if existing and existing.canonical_group_id else uuid4()

    media_image_url = recipe_data.get("mediaImageUrl") or recipe_data.get("mediaLocalPath")
    media_video_url = recipe_data.get("mediaVideoUrl")

    new_entry = GlobalRecipe(
        source_url=recipe_data.get("sourceUrl") or url,
        source_url_normalized=normalized,
        source_domain=recipe_data.get("sourceDomain") or ensure_domain(url),
        source_platform=recipe_data.get("sourcePlatform") or source,
        language_code=language_code,
        title=recipe_data.get("title"),
        description=recipe_data.get("description"),
        meal_type=recipe_data.get("mealType"),
        difficulty=recipe_data.get("difficulty"),
        prep_time=recipe_data.get("prepTime"),
        cook_time=recipe_data.get("cookTime"),
        total_time=recipe_data.get("totalTime"),
        servings=recipe_data.get("servings"),
        nutrition_calories=recipe_data.get("nutritionCalories"),
        nutrition_protein=recipe_data.get("nutritionProtein"),
        nutrition_carbs=recipe_data.get("nutritionCarbs"),
        nutrition_fat=recipe_data.get("nutritionFat"),
        media_video_url=media_video_url,
        media_image_url=media_image_url,
        tags=recipe_data.get("tags") or [],
        ingredients=recipe_data.get("ingredients") or [],
        steps=recipe_data.get("instructions") or [],
        quality_score=score,
        is_complete=is_complete,
        missing_fields=missing_fields,
        last_fetched_at=datetime.utcnow(),
        canonical_hash=canonical_hash,
        canonical_group_id=canonical_group_id,
        supersedes_id=existing.id if existing else None,
        updated_at=datetime.utcnow(),
    )

    if existing and not _is_better(score, is_complete, existing):
        existing.last_fetched_at = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        return _to_recipe_payload(existing), video_path, existing, True, existing.language_code or "en"

    session.add(new_entry)
    session.commit()
    session.refresh(new_entry)
    return _to_recipe_payload(new_entry), video_path, new_entry, False, language_code
