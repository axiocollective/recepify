from __future__ import annotations

import json
import logging
import mimetypes
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from .import_utils import (
    ImportedRecipe,
    clean_text,
    ensure_domain,
    ensure_storage_path,
    extract_json_ld_blocks,
    extract_og_image,
    extract_page_text,
    fetch_html,
    find_recipe_nodes,
    get_openai_client,
    ingredients_from_strings,
    instructions_from_strings,
    normalize_iso_duration,
    normalize_servings,
    pick_best_recipe,
    resolve_schema_image,
    safe_list,
    sync_recipe_media_to_supabase,
)
from .usage_utils import append_usage_event, build_usage_event, extract_openai_usage

logger = logging.getLogger(__name__)


class _Nutrition(BaseModel):
    calories: Optional[str] = None
    protein: Optional[str] = None
    carbs: Optional[str] = None
    fat: Optional[str] = None


class _Media(BaseModel):
    video_path: Optional[str] = Field(default=None, alias="video_path")
    image_url: Optional[str] = Field(default=None, alias="image_url")


class _LLMRecipe(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

    meal_type: Optional[str] = Field(default=None, alias="meal_type")
    difficulty: Optional[str] = None

    prep_time: Optional[str] = Field(default=None, alias="prep_time")
    cook_time: Optional[str] = Field(default=None, alias="cook_time")
    total_time: Optional[str] = Field(default=None, alias="total_time")
    servings: Optional[str] = None

    nutrition: _Nutrition = Field(default_factory=_Nutrition)

    ingredients: List[str] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)

    tags: List[str] = Field(default_factory=list)
    chefs_notes: Optional[str] = Field(default=None, alias="chefs_notes")

    media: _Media = Field(default_factory=_Media)

    source_url: Optional[str] = None
    source_domain: Optional[str] = None
    source_platform: Optional[str] = None
    extracted_via: Optional[str] = Field(default=None, alias="extracted_via")


def _resolve_schema_video(node: dict[str, Any]) -> Optional[str]:
    raw_video = node.get("video")
    if raw_video is None:
        return None
    candidates = safe_list(raw_video)
    for candidate in candidates:
        url: Optional[str] = None
        if isinstance(candidate, str):
            url = candidate.strip()
        elif isinstance(candidate, dict):
            for key in ("contentUrl", "url", "embedUrl"):
                if key in candidate and candidate[key]:
                    url = str(candidate[key]).strip()
                    break
        if url:
            return url
    return None


def _guess_video_extension(video_url: str, content_type: Optional[str]) -> str:
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip().lower())
        if ext:
            return ext
    parsed = urlparse(video_url)
    suffix = Path(parsed.path).suffix
    if suffix:
        return suffix
    return ".mp4"


def _download_recipe_video(video_url: str, platform: str = "web") -> Optional[Path]:
    if not video_url.lower().startswith(("http://", "https://")):
        return None
    target_dir = ensure_storage_path(platform, "videos", is_file=False)
    file_id = uuid.uuid4().hex[:10]
    try:
        with httpx.stream("GET", video_url, timeout=30.0, follow_redirects=True) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
            if content_type and not content_type.startswith("video/"):
                return None
            extension = _guess_video_extension(video_url, content_type or None)
            file_path = target_dir / f"{platform}_{file_id}{extension}"
            with file_path.open("wb") as output:
                for chunk in response.iter_bytes():
                    if chunk:
                        output.write(chunk)
        return file_path
    except Exception as error:
        logger.warning("Failed to download recipe video from %s: %s", video_url, error)
        return None


def _attach_video_asset(recipe: ImportedRecipe) -> None:
    if not recipe.media_video_url or recipe.media_local_path:
        return
    video_url = recipe.media_video_url
    if not isinstance(video_url, str) or not video_url.lower().startswith(("http://", "https://")):
        return
    stored_path = _download_recipe_video(video_url, recipe.source_platform or "web")
    if stored_path:
        recipe.media_video_url = str(stored_path)
        recipe.media_local_path = str(stored_path)


def _schema_to_recipe(
    node: dict[str, Any],
    url: str,
    image_url: Optional[str],
    *,
    platform: str = "web",
    extracted_via: str = "schema_org",
) -> ImportedRecipe:
    title = clean_text(str(node.get("name") or "")) or "Untitled Recipe"
    description = clean_text(str(node.get("description") or "")) or None

    servings = node.get("recipeYield")
    if isinstance(servings, list) and servings:
        servings = servings[0]
    servings = normalize_servings(servings)

    prep_time = normalize_iso_duration(node.get("prepTime"))
    cook_time = normalize_iso_duration(node.get("cookTime"))
    total_time = normalize_iso_duration(node.get("totalTime"))

    ingredients_raw = safe_list(node.get("recipeIngredient"))
    instructions_raw: List[str] = []
    instructions_field = node.get("recipeInstructions")
    for entry in safe_list(instructions_field):
        if isinstance(entry, str):
            instructions_raw.append(entry)
        elif isinstance(entry, dict):
            if entry.get("text"):
                instructions_raw.append(entry["text"])
            elif entry.get("itemListElement"):
                for inner in safe_list(entry["itemListElement"]):
                    if isinstance(inner, dict) and inner.get("text"):
                        instructions_raw.append(inner["text"])
                    elif isinstance(inner, str):
                        instructions_raw.append(inner)

    video_url = _resolve_schema_video(node)

    return ImportedRecipe(
        title=title,
        description=description,
        servings=servings,
        prep_time=prep_time,
        cook_time=cook_time,
        total_time=total_time,
        source_platform=platform,
        source_url=url,
        source_domain=ensure_domain(url),
        extracted_via=extracted_via,
        media_image_url=image_url,
        media_video_url=video_url,
        ingredients=ingredients_from_strings(ingredients_raw),
        instructions=instructions_from_strings(instructions_raw),
    )


def _openai_from_page(
    url: str,
    html: str,
    image_url: Optional[str],
    *,
    platform: str = "web",
    extracted_via_label: str = "openai_from_body",
) -> ImportedRecipe:
    client = get_openai_client()
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.title.string.strip() if soup.title and soup.title.string else None
    body_text = extract_page_text(html)[:120_000]

    payload = {"url": url, "title_tag": title_tag, "body_text": body_text}
    system_prompt = (
        "Extract a recipe from the provided web page payload and return ONLY JSON matching this schema:\n"
        "{title, description, meal_type, difficulty, prep_time, cook_time, total_time, servings,\n"
        " nutrition:{calories,protein,carbs,fat}, ingredients:[string], instructions:[string], tags:[string], chefs_notes,\n"
        " media:{video_path,image_url}, source_url, source_domain, source_platform, extracted_via}.\n"
        "Rules:\n"
        "- Ingredients must be individual lines like '500 g flour'.\n"
        "- Instructions must be actionable steps.\n"
        "- Do NOT guess values for meal_type/difficulty/nutrition/tags if missing.\n"
        "- Keep null/empty when information is unavailable.\n"
    )

    response = client.responses.parse(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        text_format=_LLMRecipe,
    )
    usage = extract_openai_usage(response)
    usage_event = build_usage_event(
        "openai",
        model="gpt-4o-mini",
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        total_tokens=usage["total_tokens"],
        stage=extracted_via_label,
    )

    llm_recipe: _LLMRecipe = response.output_parsed
    nutrition = llm_recipe.nutrition
    media = llm_recipe.media

    recipe = ImportedRecipe(
        title=llm_recipe.title or title_tag or "Untitled Recipe",
        description=llm_recipe.description,
        meal_type=llm_recipe.meal_type,
        difficulty=llm_recipe.difficulty,
        prep_time=llm_recipe.prep_time,
        cook_time=llm_recipe.cook_time,
        total_time=llm_recipe.total_time,
        servings=llm_recipe.servings,
        nutrition_calories=nutrition.calories,
        nutrition_protein=nutrition.protein,
        nutrition_carbs=nutrition.carbs,
        nutrition_fat=nutrition.fat,
        chef_notes=llm_recipe.chefs_notes,
        source_platform=platform,
        source_url=url,
        source_domain=ensure_domain(url),
        extracted_via=llm_recipe.extracted_via or extracted_via_label,
        media_image_url=image_url or media.image_url,
        media_video_url=media.video_path,
        ingredients=ingredients_from_strings(llm_recipe.ingredients),
        instructions=instructions_from_strings(llm_recipe.instructions),
        tags=llm_recipe.tags,
    )
    append_usage_event(recipe.metadata, usage_event)
    return recipe


def _openai_from_pages(
    primary_url: str,
    primary_html: str,
    secondary_url: Optional[str],
    secondary_html: Optional[str],
    image_url: Optional[str],
    *,
    platform: str = "web",
    extracted_via_label: str = "openai_from_body",
) -> ImportedRecipe:
    client = get_openai_client()

    def _title_tag(html: str) -> Optional[str]:
        soup = BeautifulSoup(html, "html.parser")
        return soup.title.string.strip() if soup.title and soup.title.string else None

    payload: dict[str, Any] = {
        "primary": {
            "url": primary_url,
            "title_tag": _title_tag(primary_html),
            "body_text": extract_page_text(primary_html)[:120_000],
        }
    }
    if secondary_url and secondary_html:
        payload["secondary"] = {
            "url": secondary_url,
            "title_tag": _title_tag(secondary_html),
            "body_text": extract_page_text(secondary_html)[:120_000],
        }

    system_prompt = (
        "Extract a recipe from the provided page text.\n"
        "You may receive a primary page and an optional secondary page for extra context.\n"
        "Return ONLY JSON matching this schema:\n"
        "{title, description, meal_type, difficulty, prep_time, cook_time, total_time, servings,\n"
        " nutrition:{calories,protein,carbs,fat}, ingredients:[string], instructions:[string], tags:[string], chefs_notes,\n"
        " media:{video_path,image_url}, source_url, source_domain, source_platform, extracted_via}.\n"
        "Rules:\n"
        "- Prefer the PRIMARY page for the recipe; use SECONDARY only if it fills gaps.\n"
        "- Ingredients must be individual lines like '500 g flour'.\n"
        "- Instructions must be actionable steps.\n"
        "- Do NOT guess values for meal_type/difficulty/nutrition/tags if missing.\n"
        "- Keep null/empty when information is unavailable.\n"
    )

    response = client.responses.parse(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        text_format=_LLMRecipe,
    )
    usage = extract_openai_usage(response)
    usage_event = build_usage_event(
        "openai",
        model="gpt-4o-mini",
        input_tokens=usage["input_tokens"],
        output_tokens=usage["output_tokens"],
        total_tokens=usage["total_tokens"],
        stage=extracted_via_label,
    )

    llm_recipe: _LLMRecipe = response.output_parsed
    nutrition = llm_recipe.nutrition
    media = llm_recipe.media

    recipe = ImportedRecipe(
        title=llm_recipe.title or _title_tag(primary_html) or "Untitled Recipe",
        description=llm_recipe.description,
        meal_type=llm_recipe.meal_type,
        difficulty=llm_recipe.difficulty,
        prep_time=llm_recipe.prep_time,
        cook_time=llm_recipe.cook_time,
        total_time=llm_recipe.total_time,
        servings=llm_recipe.servings,
        nutrition_calories=nutrition.calories,
        nutrition_protein=nutrition.protein,
        nutrition_carbs=nutrition.carbs,
        nutrition_fat=nutrition.fat,
        chef_notes=llm_recipe.chefs_notes,
        source_platform=platform,
        source_url=primary_url,
        source_domain=ensure_domain(primary_url),
        extracted_via=llm_recipe.extracted_via or extracted_via_label,
        media_image_url=image_url or media.image_url,
        media_video_url=media.video_path,
        ingredients=ingredients_from_strings(llm_recipe.ingredients),
        instructions=instructions_from_strings(llm_recipe.instructions),
        tags=llm_recipe.tags,
    )
    append_usage_event(recipe.metadata, usage_event)
    return recipe


def import_web(url: str) -> Dict[str, Any]:
    html = fetch_html(url)
    og_image = extract_og_image(html)

    schema_nodes: List[dict[str, Any]] = []
    for block in extract_json_ld_blocks(html):
        schema_nodes.extend(find_recipe_nodes(block))

    recipe: Optional[ImportedRecipe] = None
    best_node = pick_best_recipe(schema_nodes)
    if best_node:
        image = resolve_schema_image(best_node) or og_image
        recipe = _schema_to_recipe(best_node, url=url, image_url=image, platform="web")

    if recipe is None:
        try:
            recipe = _openai_from_page(url=url, html=html, image_url=og_image, platform="web")
        except Exception as error:
            raise ValueError("Failed to import recipe. The URL may not contain a readable recipe.") from error

    if recipe is None or (not recipe.ingredients and not recipe.instructions):
        raise ValueError("Failed to import recipe. The URL appears not to include recipe details.")

    _attach_video_asset(recipe)
    sync_recipe_media_to_supabase(recipe)

    recipe.tags = []
    data = recipe.model_dump_recipe()
    data.setdefault("tags", [])
    return data
