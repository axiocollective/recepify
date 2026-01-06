from __future__ import annotations

import json
import re

import logging
from datetime import datetime, date
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID, uuid4, uuid5, NAMESPACE_DNS

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Header
from sqlalchemy import text
import httpx
from sqlmodel import Session, select

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from ..config import get_settings
from ..dependencies import get_db_session
from ..models import (
    Ingredient,
    InstructionStep,
    Recipe,
    RecipeTag,
    ShoppingListItem,
    UserSettings,
    RecipeCollection,
    RecipeCollectionItem,
    UsageMonthly,
    ImportUsageMonthly,
    UsageEvent,
)
from ..schemas import (
    IngredientDTO,
    InstructionStepDTO,
    RecipeCreateDTO,
    RecipeReadDTO,
    UserSettingsReadDTO,
    UserSettingsUpdateDTO,
    ShoppingListItemDTO,
    ShoppingListSyncDTO,
    RecipeCollectionDTO,
    RecipeCollectionsSyncDTO,
)
from ..services import import_instagram as instagram_service
from ..services import import_scan as scan_service
from ..services import import_pinterest as pinterest_service
from ..services import import_tiktok as tiktok_service
from ..services import import_youtube as youtube_service
from ..services import import_web as web_service
from ..services.import_utils import get_openai_client


_SETTINGS = get_settings()
DEFAULT_USER_ID = UUID("00000000-0000-0000-0000-000000000001")

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


class ImportRequest(BaseModel):
    url: str


class ImportResponse(BaseModel):
    recipe: Union[RecipeReadDTO, Dict[str, Any]]
    videoPath: Optional[str] = None


class RecipeAssistantRecipe(BaseModel):
    title: str
    description: Optional[str] = None
    servings: Optional[str] = None
    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    total_time: Optional[str] = None
    difficulty: Optional[str] = None
    meal_type: Optional[str] = None
    source: Optional[str] = None
    nutrition_calories: Optional[str] = None
    nutrition_protein: Optional[str] = None
    nutrition_carbs: Optional[str] = None
    nutrition_fat: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    ingredients: List[str] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)


class RecipeAssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class RecipeAssistantRequest(BaseModel):
    recipe: RecipeAssistantRecipe
    messages: List[RecipeAssistantMessage]
    structured: bool = False
    usage_context: Optional[str] = None


class RecipeAssistantResponse(BaseModel):
    reply: str


CHEFGPT_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "chef_sections",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["sections"],
            "properties": {
                "sections": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["title", "bullets"],
                        "properties": {
                            "title": {"type": "string", "maxLength": 24},
                            "bullets": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 5,
                                "items": {"type": "string", "maxLength": 200},
                            },
                        },
                    },
                }
            },
        },
    },
}


SCHEMA_CORRECTION_PROMPT = "Fix the output to match the schema exactly. Return JSON only."


def _build_model_priority(raw: Optional[str]) -> tuple[str, ...]:
    if not raw:
        return ("gpt-4o",)
    models = [entry.strip() for entry in raw.split(",") if entry.strip()]
    return tuple(models) if models else ("gpt-4o",)


CHEFGPT_MODEL_CANDIDATES: tuple[str, ...] = _build_model_priority(
    getattr(_SETTINGS, "assistant_model_priority", None)
)


class AssistantSectionPayload(BaseModel):
    title: str
    bullets: List[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Section title cannot be empty.")
        if len(cleaned) > 24:
            raise ValueError("Section title must be at most 24 characters.")
        return cleaned

    @field_validator("bullets")
    @classmethod
    def validate_bullets(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("Each section must include at least one bullet.")
        if len(value) > 5:
            raise ValueError("Each section can have at most five bullets.")
        cleaned: List[str] = []
        for bullet in value:
            text = bullet.replace("\n", " ").strip()
            if text.startswith("-"):
                text = text[1:].strip()
            if not text:
                continue
            cleaned.append(text)
        if not cleaned:
            raise ValueError("Bullets cannot be empty.")
        if len(set(entry.lower() for entry in cleaned)) != len(cleaned):
            raise ValueError("Duplicate bullets detected.")
        return cleaned


class AssistantStructuredResponse(BaseModel):
    sections: List[AssistantSectionPayload]

    @model_validator(mode="after")
    def validate_sections(self) -> "AssistantStructuredResponse":
        sections = self.sections
        if not sections:
            raise ValueError("At least one section is required.")
        if len(sections) > 3:
            raise ValueError("At most three sections are allowed.")
        normalized_titles = {section.title.lower() for section in sections}
        if len(normalized_titles) != len(sections):
            raise ValueError("Section titles must be unique.")
        total_words = sum(len(bullet.split()) for section in sections for bullet in section.bullets)
        if total_words > 120:
            raise ValueError("Response exceeds the 120-word limit.")
        return self


def _build_default_sections(message: str) -> Dict[str, Any]:
    return {"sections": [{"title": "ChefGPT", "bullets": [message.strip() or "Please try again."]}]}


def _sanitize_sections_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw_sections = payload.get("sections")
    if not isinstance(raw_sections, list):
        return _build_default_sections("I couldn't parse your request—please try again.")

    sanitized_sections: List[Dict[str, Any]] = []
    seen_titles: set[str] = set()

    for index, raw_section in enumerate(raw_sections):
        if not isinstance(raw_section, dict):
            continue

        title_value = str(raw_section.get("title") or f"Section {index + 1}")
        title = title_value.strip()[:24] or f"Section {index + 1}"
        base_title = title.lower()
        duplicate_counter = 2
        while base_title in seen_titles:
            title_candidate = f"{title[:20].rstrip()} {duplicate_counter}"
            title = title_candidate[:24] or f"Section {index + 1}"
            base_title = title.lower()
            duplicate_counter += 1
        seen_titles.add(base_title)

        raw_bullets = raw_section.get("bullets") or raw_section.get("content")
        bullets: List[str] = []
        if isinstance(raw_bullets, list):
            for entry in raw_bullets:
                text = ""
                if isinstance(entry, str):
                    text = entry
                elif isinstance(entry, dict) and "text" in entry:
                    text = str(entry["text"])
                text = text.replace("\n", " ").strip()
                if not text:
                    continue
                if text.startswith("-"):
                    text = text[1:].strip()
                bullets.append(text)
        elif isinstance(raw_bullets, str):
            for part in raw_bullets.split("\n"):
                text = part.strip()
                if text.startswith("-"):
                    text = text[1:].strip()
                if text:
                    bullets.append(text)

        if not bullets:
            continue

        unique_bullets: List[str] = []
        seen_bullets: set[str] = set()
        for bullet in bullets:
            normalized = bullet.lower()
            if normalized in seen_bullets:
                continue
            seen_bullets.add(normalized)
            unique_bullets.append(bullet)
            if len(unique_bullets) >= 5:
                break

        sanitized_sections.append({"title": title, "bullets": unique_bullets})
        if len(sanitized_sections) >= 3:
            break

    total_words = 0
    limit_reached = False
    for section in sanitized_sections:
        trimmed_bullets: List[str] = []
        for bullet in section["bullets"]:
            words = bullet.split()
            total_words += len(words)
            if total_words > 120:
                remaining = max(0, 120 - (total_words - len(words)))
                snippet = " ".join(words[:remaining]).strip()
                if snippet:
                    trimmed_bullets.append(snippet + "…")
                limit_reached = True
                break
            trimmed_bullets.append(bullet)
        section["bullets"] = trimmed_bullets
        if limit_reached:
            break
    sanitized_sections = [section for section in sanitized_sections if section["bullets"]]

    if not sanitized_sections:
        return _build_default_sections("I couldn't interpret the response—please rephrase.")

    return {"sections": sanitized_sections}


class RecipeFinderCandidate(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    total_time: Optional[str] = None
    category: Optional[str] = None
    ingredients: List[str] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    nutrition_calories: Optional[str] = None
    nutrition_protein: Optional[str] = None
    nutrition_carbs: Optional[str] = None
    nutrition_fat: Optional[str] = None
    is_favorite: bool = False


class RecipeFinderRequest(BaseModel):
    query: str
    recipes: List[RecipeFinderCandidate]


class RecipeFinderMatch(BaseModel):
    id: str
    summary: str


class RecipeFinderResponse(BaseModel):
    reply: str
    matches: List[RecipeFinderMatch] = Field(default_factory=list)


def _recipe_to_dto(recipe: Recipe) -> RecipeReadDTO:
    return RecipeReadDTO(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        meal_type=recipe.meal_type,
        difficulty=recipe.difficulty,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        total_time=recipe.total_time,
        servings=recipe.servings,
        nutrition_calories=recipe.nutrition_calories,
        nutrition_protein=recipe.nutrition_protein,
        nutrition_carbs=recipe.nutrition_carbs,
        nutrition_fat=recipe.nutrition_fat,
        chef_notes=recipe.chef_notes,
        source_platform=recipe.source_platform,
        source_url=recipe.source_url,
        source_domain=recipe.source_domain,
        imported_at=recipe.imported_at,
        media_video_url=recipe.media_video_url,
        media_image_url=recipe.media_image_url,
        media_local_path=recipe.media_local_path,
        is_favorite=recipe.is_favorite,
        ingredients=[IngredientDTO.model_validate(ing) for ing in recipe.ingredients],
        instructions=[InstructionStepDTO.model_validate(step) for step in recipe.instructions],
        tags=[tag.name for tag in recipe.tags],
    )


def _sync_children(recipe: Recipe, payload: RecipeCreateDTO) -> None:
    recipe.ingredients.clear()
    for ing in payload.ingredients:
        recipe.ingredients.append(
            Ingredient(
                line=ing.line,
                amount=ing.amount,
                name=ing.name,
            )
        )

    recipe.instructions.clear()
    for idx, step in enumerate(payload.instructions, start=1):
        recipe.instructions.append(
            InstructionStep(
                step_number=step.step_number or idx,
                text=step.text,
            )
        )

    recipe.tags.clear()
    for tag in payload.tags:
        recipe.tags.append(RecipeTag(name=tag))


def _format_recipe_context(recipe: RecipeAssistantRecipe) -> str:
    sections: List[str] = [f"Title: {recipe.title}"]
    if recipe.description:
        sections.append(f"Description: {recipe.description}")
    meta_bits = []
    if recipe.servings:
        meta_bits.append(f"Servings: {recipe.servings}")
    if recipe.difficulty:
        meta_bits.append(f"Difficulty: {recipe.difficulty}")
    if recipe.meal_type:
        meta_bits.append(f"Meal type: {recipe.meal_type}")
    if recipe.source:
        meta_bits.append(f"Source: {recipe.source}")
    time_bits = [value for value in [recipe.prep_time, recipe.cook_time, recipe.total_time] if value]
    if meta_bits:
        sections.append("; ".join(meta_bits))
    if time_bits:
        sections.append("Times: " + ", ".join(time_bits))
    if recipe.tags:
        sections.append("Tags: " + ", ".join(recipe.tags))
    if recipe.ingredients:
        sections.append(
            "Ingredients:\n" + "\n".join(f"- {item}" for item in recipe.ingredients if item.strip())
        )
    if recipe.steps:
        sections.append(
            "Steps:\n"
            + "\n".join(f"{idx + 1}. {step}" for idx, step in enumerate(recipe.steps) if step.strip())
        )
    nutrition_bits: List[str] = []
    if recipe.nutrition_calories:
        nutrition_bits.append(f"Calories: {recipe.nutrition_calories}")
    if recipe.nutrition_protein:
        nutrition_bits.append(f"Protein: {recipe.nutrition_protein}")
    if recipe.nutrition_carbs:
        nutrition_bits.append(f"Carbs: {recipe.nutrition_carbs}")
    if recipe.nutrition_fat:
        nutrition_bits.append(f"Fat: {recipe.nutrition_fat}")
    if nutrition_bits:
        sections.append("Nutrition: " + ", ".join(nutrition_bits))
    if recipe.notes:
        sections.append(f"Chef notes: {recipe.notes}")
    return "\n".join(section for section in sections if section)


def _truncate_join(items: List[str], limit: int) -> Optional[str]:
    cleaned = [item.strip() for item in items if item and item.strip()]
    if not cleaned:
        return None
    snippet = cleaned[:limit]
    text = "; ".join(snippet)
    if len(cleaned) > limit:
        text += " ..."
    return text


def _format_finder_catalog(recipes: List[RecipeFinderCandidate]) -> str:
    entries: List[str] = []
    for recipe in recipes:
        sections = [f"ID: {recipe.id}", f"Title: {recipe.title}"]
        if recipe.description:
            short_description = recipe.description.strip()
            if len(short_description) > 160:
                short_description = short_description[:157].rstrip() + "..."
            sections.append(f"Description: {short_description}")
        meta_bits = []
        if recipe.category:
            meta_bits.append(f"Meal: {recipe.category}")
        if recipe.prep_time:
            meta_bits.append(f"Prep: {recipe.prep_time}")
        if recipe.cook_time:
            meta_bits.append(f"Cook: {recipe.cook_time}")
        if recipe.total_time:
            meta_bits.append(f"Total: {recipe.total_time}")
        if meta_bits:
            sections.append("; ".join(meta_bits))
        if recipe.tags:
            sections.append("Tags: " + ", ".join(recipe.tags))
        ingredient_preview = _truncate_join(recipe.ingredients, 4)
        if ingredient_preview:
            sections.append(f"Key ingredients: {ingredient_preview}")
        step_preview = _truncate_join(recipe.steps, 2)
        if step_preview:
            sections.append(f"Steps snapshot: {step_preview}")
        nutrition_bits: List[str] = []
        if recipe.nutrition_calories:
            nutrition_bits.append(f"Calories: {recipe.nutrition_calories}")
        if recipe.nutrition_protein:
            nutrition_bits.append(f"Protein: {recipe.nutrition_protein}")
        if recipe.nutrition_carbs:
            nutrition_bits.append(f"Carbs: {recipe.nutrition_carbs}")
        if recipe.nutrition_fat:
            nutrition_bits.append(f"Fat: {recipe.nutrition_fat}")
        if nutrition_bits:
            sections.append("Nutrition: " + ", ".join(nutrition_bits))
        if recipe.notes:
            sections.append(f"Chef notes: {recipe.notes}")
        if recipe.is_favorite:
            sections.append("Favorite: yes")
        entries.append("\n".join(sections))
    return "\n\n".join(entries)


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", value.lower())


def _extract_time_target(question: str) -> Optional[int]:
    minute_match = re.search(r"(\d+)\s*(?:min|minutes?)", question, re.IGNORECASE)
    if minute_match:
        return int(minute_match.group(1))
    hour_match = re.search(r"(\d+)\s*(?:h|hr|hrs|hour|hours)", question, re.IGNORECASE)
    if hour_match:
        return int(hour_match.group(1)) * 60
    return None


def _parse_recipe_minutes(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    minute_match = re.search(r"(\d+)\s*min", value, re.IGNORECASE)
    if minute_match:
        return int(minute_match.group(1))
    hour_match = re.search(r"(\d+)\s*h", value, re.IGNORECASE)
    if hour_match:
        return int(hour_match.group(1)) * 60
    return None


def _score_finder_candidate(
    recipe: RecipeFinderCandidate,
    tokens: List[str],
    target_minutes: Optional[int],
) -> float:
    score = 0.0
    combined_text = " ".join(
        filter(
            None,
            [
                recipe.title,
                recipe.description,
                recipe.category,
                " ".join(recipe.tags or []),
                " ".join(recipe.steps or []),
                recipe.notes,
                recipe.nutrition_calories,
                recipe.nutrition_protein,
                recipe.nutrition_carbs,
                recipe.nutrition_fat,
            ],
        )
    ).lower()

    if target_minutes:
        recipe_minutes = (
            _parse_recipe_minutes(recipe.total_time)
            or _parse_recipe_minutes(recipe.cook_time)
            or _parse_recipe_minutes(recipe.prep_time)
        )
        if recipe_minutes:
            if recipe_minutes <= target_minutes:
                score += 3
            elif recipe_minutes <= target_minutes + 10:
                score += 1

    for token in tokens:
        if len(token) < 3:
            continue
        if any(token in (ingredient.lower()) for ingredient in recipe.ingredients or []):
            score += 1
        if token in combined_text:
            score += 1

    if recipe.is_favorite:
        score += 0.5

    return score


def _filter_finder_candidates(
    query: str, recipes: List[RecipeFinderCandidate], limit: int = 8
) -> List[RecipeFinderCandidate]:
    if len(recipes) <= limit:
        return recipes

    normalized = _normalize_text(query)
    tokens = [token for token in normalized.split() if token]
    target_minutes = _extract_time_target(query)

    scored: List[tuple[float, int, RecipeFinderCandidate]] = []
    for index, recipe in enumerate(recipes):
        score = _score_finder_candidate(recipe, tokens, target_minutes)
        if score > 0:
            scored.append((score, index, recipe))

    if scored:
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [entry[2] for entry in scored[:limit]]

    return recipes[:limit]


def _build_keyword_finder_response(
    query: str, recipes: List[RecipeFinderCandidate]
) -> tuple[str, List[RecipeFinderMatch]]:
    if not recipes:
        return (
            "Your recipe box is empty. Add a few recipes and try again for tailored suggestions.",
            [],
        )

    normalized = _normalize_text(query)
    tokens = [token for token in normalized.split() if token]
    target_minutes = _extract_time_target(query)

    scored: List[tuple[float, int, RecipeFinderCandidate]] = []
    for index, recipe in enumerate(recipes):
        score = _score_finder_candidate(recipe, tokens, target_minutes)
        title_lower = (recipe.title or "").lower()
        if tokens and any(token in title_lower for token in tokens):
            score += 1
        if not tokens:
            score += 0.25
        scored.append((score, index, recipe))

    if tokens:
        filtered_scores = [entry for entry in scored if entry[0] > 0]
        if filtered_scores:
            scored = filtered_scores

    scored.sort(key=lambda entry: (-entry[0], entry[1]))
    top_matches = [entry[2] for entry in scored[:3]]

    if not top_matches:
        return (
            "I couldn't find any strong matches yet. Try asking for a cuisine, ingredient, or cooking time.",
            [],
        )

    match_payload: List[RecipeFinderMatch] = []
    lines: List[str] = []
    for idx, recipe in enumerate(top_matches, start=1):
        summary = _summarize_keyword_reason(recipe, tokens, target_minutes)
        match_payload.append(RecipeFinderMatch(id=recipe.id, summary=summary))
        lines.append(f"{idx}. {recipe.title} – {summary}")

    response = "\n".join(lines)
    return response, match_payload


def _summarize_keyword_reason(
    recipe: RecipeFinderCandidate,
    tokens: List[str],
    target_minutes: Optional[int],
) -> str:
    lowered_tokens = [token.lower() for token in tokens]
    fragments: List[str] = []

    time_text = recipe.total_time or recipe.cook_time or recipe.prep_time
    if time_text:
        if target_minutes:
            fragments.append(f"ready in {time_text}, fits your time window")
        else:
            fragments.append(f"ready in {time_text}")

    matching_tag = _find_matching_token(recipe.tags or [], lowered_tokens)
    if matching_tag:
        fragments.append(f"tagged {matching_tag}")
    elif recipe.tags:
        fragments.append(f"tagged {recipe.tags[0]}")

    matching_ingredient = _find_matching_token(recipe.ingredients or [], lowered_tokens)
    if matching_ingredient:
        fragments.append(f"features {matching_ingredient}")

    nutrition_bits = []
    if recipe.nutrition_calories:
        nutrition_bits.append(f"{recipe.nutrition_calories} calories")
    if recipe.nutrition_protein:
        nutrition_bits.append(f"{recipe.nutrition_protein} protein")
    if recipe.nutrition_carbs:
        nutrition_bits.append(f"{recipe.nutrition_carbs} carbs")
    if recipe.nutrition_fat:
        nutrition_bits.append(f"{recipe.nutrition_fat} fat")
    if nutrition_bits and any(token in {"calorie", "protein", "carb", "fat", "macro"} for token in lowered_tokens):
        fragments.append(" / ".join(nutrition_bits))
    elif recipe.nutrition_calories and not fragments:
        fragments.append(f"about {recipe.nutrition_calories} calories")

    if recipe.is_favorite:
        fragments.append("already one of your favorites")

    if not fragments and recipe.notes:
        fragments.append(recipe.notes.strip()[:80])

    if not fragments:
        fragments.append("popular pick from your saved recipes")

    return ", ".join(fragment for fragment in fragments if fragment)


def _find_matching_token(values: List[str], tokens: List[str]) -> Optional[str]:
    if not values or not tokens:
        return None
    for value in values:
        lowered = (value or "").lower()
        for token in tokens:
            if token and token in lowered:
                return value
    return None


def _extract_json_object(payload: str) -> Dict[str, Any]:
    text = payload.strip()
    if not text:
        raise ValueError("Empty response")
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    if not text.startswith("{"):
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            text = match.group(0)
    return json.loads(text)


def _extract_assistant_text(response: Any) -> str:
    parts: List[str] = []
    output = getattr(response, "output", None) or []
    for block in output:
        content = getattr(block, "content", None) or []
        for item in content:
            text_value = getattr(item, "text", None)
            if text_value:
                parts.append(text_value)
    output_text = getattr(response, "output_text", None)
    if output_text:
        if isinstance(output_text, list):
            parts.extend(str(entry) for entry in output_text if entry)
        else:
            parts.append(str(output_text))
    return "\n".join(part for part in parts if part).strip()


def _extract_structured_json(response: Any) -> Optional[str]:
    output = getattr(response, "output", None) or []
    for block in output:
        content_items = getattr(block, "content", None) or []
        for item in content_items:
            json_value = getattr(item, "json", None)
            if json_value is not None:
                try:
                    return json.dumps(json_value)
                except TypeError:
                    continue
            text_value = getattr(item, "text", None)
            if text_value:
                return str(text_value)
    output_text = getattr(response, "output_text", None)
    if output_text:
        if isinstance(output_text, list):
            for entry in output_text:
                if entry:
                    return str(entry)
        else:
            return str(output_text)
    return None


def _parse_structured_reply(raw_text: str) -> Optional[AssistantStructuredResponse]:
    try:
        payload = _sanitize_sections_payload(_extract_json_object(raw_text))
    except (ValueError, json.JSONDecodeError):
        return None
    if not payload.get("sections"):
        return None
    try:
        return AssistantStructuredResponse.model_validate(payload)
    except ValidationError:
        return None


def _generate_structured_sections_response(
    client: Any, conversation: List[Dict[str, str]]
) -> tuple[AssistantStructuredResponse, Dict[str, int], Optional[str]]:
    last_error: Optional[Exception] = None

    def invoke(messages: List[Dict[str, str]], model_name: str) -> tuple[Optional[AssistantStructuredResponse], Dict[str, int]]:
        nonlocal last_error
        try:
            response = client.responses.parse(
                model=model_name,
                input=messages,
                text_format=AssistantStructuredResponse,
            )
            return response.output_parsed, _extract_usage_details(response)
        except Exception as exc:
            last_error = exc
            logger.warning("ChefGPT model %s failed to respond: %s", model_name, exc)
            return None, {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    def try_models(messages: List[Dict[str, str]]) -> tuple[Optional[AssistantStructuredResponse], Dict[str, int], Optional[str]]:
        for model_name in CHEFGPT_MODEL_CANDIDATES:
            structured, usage = invoke(messages, model_name)
            if structured:
                return structured, usage, model_name
        return None, {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}, None

    structured, usage, model_name = try_models(conversation)
    if structured:
        return structured, usage, model_name

    retry_conversation = conversation + [
        {"role": "user", "content": SCHEMA_CORRECTION_PROMPT},
    ]
    structured, usage, model_name = try_models(retry_conversation)
    if structured:
        return structured, usage, model_name

    fallback_message = (
        "I'm struggling to format this reply. Please try another question or rephrase."
        if last_error is None
        else "I'm having trouble reaching the model. Please try again shortly."
    )
    return AssistantStructuredResponse(
        sections=[
            AssistantSectionPayload(
                title="ChefGPT",
                bullets=[fallback_message],
            )
        ]
    ), {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}, None


def _generate_plain_assistant_response(
    client: Any, conversation: List[Dict[str, str]]
) -> tuple[str, Dict[str, int], Optional[str]]:
    last_error: Optional[Exception] = None
    for model_name in CHEFGPT_MODEL_CANDIDATES or ("gpt-4o-mini",):
        try:
            response = client.responses.create(
                model=model_name,
                input=conversation,
            )
            text = _extract_assistant_text(response)
            if text:
                return text, _extract_usage_details(response), model_name
        except Exception as exc:
            last_error = exc
            logger.warning("ChefGPT plain mode with %s failed: %s", model_name, exc)
            continue
    message = "Unable to contact the AI assistant. Please try again in a moment."
    if last_error:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=message,
        ) from last_error
    raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=message)


def _get_or_create_user_settings(session: Session, user_id: UUID) -> UserSettings:
    settings = session.get(UserSettings, user_id)
    if settings:
        return settings
    settings = UserSettings(user_id=user_id)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


def _delete_user_data(session: Session, user_id: UUID) -> None:
    params = {"user_id": str(user_id)}
    session.exec(
        text(
            "delete from recipe_collection_items where collection_id in "
            "(select id from recipe_collections where owner_id = :user_id)"
        ),
        params,
    )
    session.exec(text("delete from recipe_collections where owner_id = :user_id"), params)
    session.exec(
        text("delete from recipe_ingredients where recipe_id in (select id from recipes where owner_id = :user_id)"),
        params,
    )
    session.exec(
        text("delete from recipe_steps where recipe_id in (select id from recipes where owner_id = :user_id)"),
        params,
    )
    session.exec(text("delete from recipe_likes where owner_id = :user_id"), params)
    session.exec(text("delete from recipes where owner_id = :user_id"), params)
    session.exec(text("delete from shopping_list_items where owner_id = :user_id"), params)
    session.exec(text("delete from shopping_list_item where user_id = :user_id"), params)
    session.exec(text("delete from usage_monthly where owner_id = :user_id"), params)
    session.exec(text("delete from import_usage_monthly where owner_id = :user_id"), params)
    session.exec(text("delete from profiles where id = :user_id"), params)
    session.commit()


@router.get("/users/me/settings", response_model=UserSettingsReadDTO)
def get_user_settings(session: Session = Depends(get_db_session)) -> UserSettingsReadDTO:
    settings = _get_or_create_user_settings(session, DEFAULT_USER_ID)
    return settings


@router.put("/users/me/settings", response_model=UserSettingsReadDTO)
def update_user_settings(
    payload: UserSettingsUpdateDTO, session: Session = Depends(get_db_session)
) -> UserSettingsReadDTO:
    settings = _get_or_create_user_settings(session, DEFAULT_USER_ID)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field_name, value)
    settings.updated_at = datetime.utcnow()
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_account(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> None:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-User-Id header is required.")
    try:
        user_id = UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id.") from exc

    _delete_user_data(session, user_id)

    if not _SETTINGS.supabase_url or not _SETTINGS.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase service role key is not configured.",
        )

    admin_url = f"{_SETTINGS.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {_SETTINGS.supabase_service_role_key}",
        "apikey": _SETTINGS.supabase_service_role_key,
    }
    response = httpx.delete(admin_url, headers=headers, timeout=10.0)
    if response.status_code >= 300:
        logger.error("Failed to delete Supabase user: %s", response.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to delete Supabase user.",
        )


@router.get("/recipes", response_model=List[RecipeReadDTO])
def list_recipes(session: Session = Depends(get_db_session)) -> List[RecipeReadDTO]:
    recipes = session.exec(select(Recipe)).all()
    return [_recipe_to_dto(recipe) for recipe in recipes]


@router.get("/recipes/{recipe_id}", response_model=RecipeReadDTO)
def get_recipe(recipe_id: UUID, session: Session = Depends(get_db_session)) -> RecipeReadDTO:
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return _recipe_to_dto(recipe)


@router.post("/recipes", response_model=RecipeReadDTO, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: RecipeCreateDTO, session: Session = Depends(get_db_session)) -> RecipeReadDTO:
    recipe = Recipe(
        title=payload.title,
        description=payload.description,
        meal_type=payload.meal_type,
        difficulty=payload.difficulty,
        prep_time=payload.prep_time,
        cook_time=payload.cook_time,
        total_time=payload.total_time,
        servings=payload.servings,
        nutrition_calories=payload.nutrition_calories,
        nutrition_protein=payload.nutrition_protein,
        nutrition_carbs=payload.nutrition_carbs,
        nutrition_fat=payload.nutrition_fat,
        chef_notes=payload.chef_notes,
        source_platform=payload.source_platform,
        source_url=payload.source_url,
        source_domain=payload.source_domain,
        media_video_url=payload.media_video_url,
        media_image_url=payload.media_image_url,
        media_local_path=payload.media_local_path,
        is_favorite=payload.is_favorite,
    )
    if payload.imported_at:
        recipe.imported_at = payload.imported_at

    _sync_children(recipe, payload)
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return _recipe_to_dto(recipe)


@router.put("/recipes/{recipe_id}", response_model=RecipeReadDTO)
def update_recipe(
    recipe_id: UUID, payload: RecipeCreateDTO, session: Session = Depends(get_db_session)
) -> RecipeReadDTO:
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    recipe.title = payload.title
    recipe.description = payload.description
    recipe.meal_type = payload.meal_type
    recipe.difficulty = payload.difficulty
    recipe.prep_time = payload.prep_time
    recipe.cook_time = payload.cook_time
    recipe.total_time = payload.total_time
    recipe.servings = payload.servings
    recipe.nutrition_calories = payload.nutrition_calories
    recipe.nutrition_protein = payload.nutrition_protein
    recipe.nutrition_carbs = payload.nutrition_carbs
    recipe.nutrition_fat = payload.nutrition_fat
    recipe.chef_notes = payload.chef_notes
    recipe.source_platform = payload.source_platform
    recipe.source_url = payload.source_url
    recipe.source_domain = payload.source_domain
    if payload.imported_at:
        recipe.imported_at = payload.imported_at
    recipe.media_video_url = payload.media_video_url
    recipe.media_image_url = payload.media_image_url
    recipe.media_local_path = payload.media_local_path
    recipe.is_favorite = payload.is_favorite

    _sync_children(recipe, payload)
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return _recipe_to_dto(recipe)


@router.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: UUID, session: Session = Depends(get_db_session)) -> None:
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    session.delete(recipe)
    session.commit()


@router.post("/import/web", response_model=ImportResponse)
def import_web(
    payload: ImportRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> ImportResponse:
    request_id = uuid4()
    try:
        recipe_data = web_service.import_web(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    has_data = _has_import_data(recipe_data)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        if has_data:
            _increment_import_usage(session, owner_id, "web")
        _log_usage_events(
            session,
            owner_id,
            request_id=request_id,
            event_type="import",
            source="web",
            events=_extract_usage_events(recipe_data),
        )
    return ImportResponse(recipe=recipe_data)


@router.post("/import/tiktok", response_model=ImportResponse)
def import_tiktok(
    payload: ImportRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> ImportResponse:
    request_id = uuid4()
    try:
        recipe_data, video_path = tiktok_service.import_tiktok(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    has_data = _has_import_data(recipe_data)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        if has_data:
            _increment_import_usage(session, owner_id, "tiktok")
        _log_usage_events(
            session,
            owner_id,
            request_id=request_id,
            event_type="import",
            source="tiktok",
            events=_extract_usage_events(recipe_data),
        )
    return ImportResponse(recipe=recipe_data, videoPath=video_path)


@router.post("/import/instagram", response_model=ImportResponse)
def import_instagram(
    payload: ImportRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> ImportResponse:
    request_id = uuid4()
    try:
        recipe_data, video_path = instagram_service.import_instagram(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    has_data = _has_import_data(recipe_data)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        if has_data:
            _increment_import_usage(session, owner_id, "instagram")
        _log_usage_events(
            session,
            owner_id,
            request_id=request_id,
            event_type="import",
            source="instagram",
            events=_extract_usage_events(recipe_data),
        )
    return ImportResponse(recipe=recipe_data, videoPath=video_path)


@router.post("/import/pinterest", response_model=ImportResponse)
def import_pinterest(
    payload: ImportRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> ImportResponse:
    request_id = uuid4()
    try:
        recipe_data = pinterest_service.import_pinterest(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    has_data = _has_import_data(recipe_data)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        if has_data:
            _increment_import_usage(session, owner_id, "pinterest")
        _log_usage_events(
            session,
            owner_id,
            request_id=request_id,
            event_type="import",
            source="pinterest",
            events=_extract_usage_events(recipe_data),
        )
    return ImportResponse(recipe=recipe_data)


@router.post("/import/youtube", response_model=ImportResponse)
def import_youtube(
    payload: ImportRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> ImportResponse:
    request_id = uuid4()
    try:
        recipe_data = youtube_service.import_youtube(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    has_data = _has_import_data(recipe_data)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        if has_data:
            _increment_import_usage(session, owner_id, "youtube")
        _log_usage_events(
            session,
            owner_id,
            request_id=request_id,
            event_type="import",
            source="youtube",
            events=_extract_usage_events(recipe_data),
        )
    return ImportResponse(recipe=recipe_data)


@router.post("/import/scan", response_model=ImportResponse)
async def import_scan(
    files: Optional[List[UploadFile]] = File(default=None),
    file: Optional[UploadFile] = File(default=None),
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> ImportResponse:
    request_id = uuid4()
    uploads: List[UploadFile] = []
    if files:
        uploads.extend(files)
    if file:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")

    images: List[Dict[str, Optional[str]]] = []
    for upload in uploads[:3]:
        contents = await upload.read()
        if not contents:
            continue
        images.append(
            {
                "bytes": contents,
                "filename": upload.filename,
                "content_type": upload.content_type,
            }
        )
    if not images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")

    try:
        recipe_data = scan_service.import_scan(images)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    has_data = _has_import_data(recipe_data)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        if has_data:
            _increment_import_usage(session, owner_id, "scan")
        _log_usage_events(
            session,
            owner_id,
            request_id=request_id,
            event_type="scan",
            source="scan",
            events=_extract_usage_events(recipe_data),
        )
    return ImportResponse(recipe=recipe_data)

def _has_import_data(recipe_data: Dict[str, Any]) -> bool:
    ingredients = recipe_data.get("ingredients") or []
    instructions = recipe_data.get("instructions") or []
    return bool(ingredients or instructions)


def _extract_usage_events(recipe_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    metadata = recipe_data.get("metadata") if isinstance(recipe_data, dict) else None
    if not isinstance(metadata, dict):
        return []
    events = metadata.get("usageEvents")
    if not isinstance(events, list):
        return []
    return [event for event in events if isinstance(event, dict)]



@router.post("/assistant/recipe", response_model=RecipeAssistantResponse)
def recipe_assistant(
    payload: RecipeAssistantRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> RecipeAssistantResponse:
    recipe_context = _format_recipe_context(payload.recipe)
    client = get_openai_client()
    base_instructions = (
        "You are Recipefy's AI sous-chef. Stay focused on the supplied recipe (ingredients, steps, timers, "
        "nutrition, notes), cite it directly, and keep answers concise, actionable, and friendly. "
        "If fields are missing, acknowledge that and offer guidance."
    )
    conversation: List[Dict[str, str]] = [
        {"role": "system", "content": base_instructions},
        {
            "role": "user",
            "content": f"BASELINE RECIPE (trimmed for speed):\n{recipe_context[:2000]}",
        },
    ]
    for message in payload.messages:
        conversation.append({"role": message.role, "content": message.content})

    usage_details = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    tokens_weighted = 0
    model_name = None
    if payload.structured:
        structured_response, usage_details, model_name = _generate_structured_sections_response(client, conversation)
        tokens_weighted = _apply_token_weight(usage_details["total_tokens"], model_name)
        reply_payload = json.dumps(structured_response.model_dump())
    else:
        reply_payload, usage_details, model_name = _generate_plain_assistant_response(client, conversation)
        tokens_weighted = _apply_token_weight(usage_details["total_tokens"], model_name)
    if x_user_email or x_user_id:
        owner_id = _resolve_user_id(x_user_email, x_user_id)
        _increment_ai_usage(session, owner_id, tokens_weighted)
        _log_usage_events(
            session,
            owner_id,
            request_id=uuid4(),
            event_type="ai_assistant",
            source="assistant",
            events=[
                {
                    "provider": "openai",
                    "model": model_name,
                    "input_tokens": usage_details["input_tokens"],
                    "output_tokens": usage_details["output_tokens"],
                    "total_tokens": usage_details["total_tokens"],
                    "structured": bool(payload.structured),
                    "messages": len(payload.messages),
                    "usage_context": payload.usage_context,
                }
            ],
            import_credits_used=0,
        )
    return RecipeAssistantResponse(reply=reply_payload)


@router.post("/assistant/finder", response_model=RecipeFinderResponse)
def recipe_finder(
    payload: RecipeFinderRequest,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> RecipeFinderResponse:
    query = payload.query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty."
        )
    if not payload.recipes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Provide at least one recipe."
        )

    ai_disabled = getattr(_SETTINGS, "assistant_disable_finder_ai", False)
    ai_error: Optional[Exception] = None
    client = None
    use_ai = not ai_disabled
    if use_ai:
        try:
            client = get_openai_client()
        except Exception as exc:
            logger.warning("ChefGPT finder unavailable (client init failed): %s", exc)
            ai_error = exc
            use_ai = False
    max_recipes = 30
    filtered_recipes = _filter_finder_candidates(query, payload.recipes, limit=12)
    catalog_recipes = filtered_recipes[:max_recipes]
    catalog = _format_finder_catalog(catalog_recipes)
    if not catalog:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No recipe details available."
        )

    if use_ai and client is not None:
        system_message = (
            "You are ChefGPT, Recipefy's AI sous-chef and recipe librarian. "
            "Study the catalog entries carefully (title, tags, cooking times, ingredients, nutrition, notes). "
            "Recommend the best matching recipes—up to three—and write a natural-language response that sounds like a helpful chef. "
            "Highlight why each pick fits the request, referencing ingredients, cooking time, tags, or nutrition when relevant. "
            "Respond ONLY in JSON with this schema: "
            '{"response": "natural-language message with a bulleted or numbered list of recommended recipes", '
            '"matches": [{"id": "recipe id from catalog", "summary": "short reason referencing details"}]}. '
            "If nothing fits, the response should explain why and matches must be an empty array."
        )
        conversation = [
            {"role": "system", "content": system_message},
            {
                "role": "user",
                "content": f"User request: {query}\n\nRecipe catalog:\n{catalog}",
            },
        ]

        try:
            response = client.responses.create(
                model="gpt-4o-mini",
                input=conversation,
            )
            raw_text = _extract_assistant_text(response)
            parsed = _extract_json_object(raw_text)
            allowed_ids = {recipe.id for recipe in catalog_recipes}
            matches_payload: List[RecipeFinderMatch] = []
            for entry in parsed.get("matches", []):
                recipe_id = entry.get("id")
                summary = entry.get("summary", "").strip()
                if recipe_id in allowed_ids and summary:
                    matches_payload.append(RecipeFinderMatch(id=recipe_id, summary=summary))

            reply_text = parsed.get("response") or "I couldn't find a perfect match in your recipe box."
            if x_user_email or x_user_id:
                usage_details = _extract_usage_details(response)
                tokens_weighted = _apply_token_weight(usage_details["total_tokens"], "gpt-4o-mini")
                owner_id = _resolve_user_id(x_user_email, x_user_id)
                _increment_ai_usage(session, owner_id, tokens_weighted)
                _log_usage_events(
                    session,
                    owner_id,
                    request_id=uuid4(),
                    event_type="ai_finder",
                    source="finder",
                    events=[
                        {
                            "provider": "openai",
                            "model": "gpt-4o-mini",
                            "input_tokens": usage_details["input_tokens"],
                            "output_tokens": usage_details["output_tokens"],
                            "total_tokens": usage_details["total_tokens"],
                            "matches": len(matches_payload),
                        }
                    ],
                    import_credits_used=0,
                )
            return RecipeFinderResponse(reply=reply_text.strip(), matches=matches_payload[:3])
        except Exception as exc:
            logger.warning("ChefGPT finder failed, falling back to keyword search: %s", exc)
            ai_error = exc

    fallback_reply, fallback_matches = _build_keyword_finder_response(query, catalog_recipes)
    if ai_error:
        fallback_reply = (
            fallback_reply
            + "\n\n(ChefGPT is temporarily offline, so these are keyword-based matches.)"
        )
    return RecipeFinderResponse(reply=fallback_reply.strip(), matches=fallback_matches[:3])


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _resolve_user_id(raw_email: Optional[str], raw_user_id: Optional[str] = None) -> UUID:
    if raw_user_id:
        try:
            return UUID(raw_user_id)
        except ValueError:
            pass
    if not raw_email:
        return DEFAULT_USER_ID
    normalized = raw_email.strip().lower()
    if not normalized:
        return DEFAULT_USER_ID
    return uuid5(NAMESPACE_DNS, f"recepify:{normalized}")


def _get_period_start(reference: Optional[datetime] = None) -> date:
    point = reference or datetime.utcnow()
    return date(point.year, point.month, 1)


def _extract_usage_tokens(response: Any) -> int:
    usage = getattr(response, "usage", None)
    if usage is None:
        return 0
    total = getattr(usage, "total_tokens", None)
    if isinstance(total, int):
        return max(0, total)
    if isinstance(usage, dict):
        total = usage.get("total_tokens")
        if isinstance(total, int):
            return max(0, total)
    input_tokens = getattr(usage, "input_tokens", None)
    output_tokens = getattr(usage, "output_tokens", None)
    if isinstance(usage, dict):
        input_tokens = usage.get("input_tokens", input_tokens)
        output_tokens = usage.get("output_tokens", output_tokens)
    if isinstance(input_tokens, int) or isinstance(output_tokens, int):
        return max(0, (input_tokens or 0) + (output_tokens or 0))
    return 0


def _extract_usage_details(response: Any) -> Dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None and isinstance(response, dict):
        usage = response.get("usage")

    input_tokens = 0
    output_tokens = 0
    total_tokens = 0

    if isinstance(usage, dict):
        input_tokens = int(usage.get("input_tokens") or 0)
        output_tokens = int(usage.get("output_tokens") or 0)
        total_tokens = int(usage.get("total_tokens") or 0)
    else:
        input_tokens = int(getattr(usage, "input_tokens", 0) or 0) if usage is not None else 0
        output_tokens = int(getattr(usage, "output_tokens", 0) or 0) if usage is not None else 0
        total_tokens = int(getattr(usage, "total_tokens", 0) or 0) if usage is not None else 0

    if total_tokens <= 0:
        total_tokens = max(0, input_tokens + output_tokens)

    return {
        "input_tokens": max(0, input_tokens),
        "output_tokens": max(0, output_tokens),
        "total_tokens": max(0, total_tokens),
    }


def _apply_token_weight(tokens: int, model_name: Optional[str]) -> int:
    if tokens <= 0:
        return 0
    weights = {
        "gpt-4o-mini": 1.0,
        "o4-mini": 1.2,
        "gpt-4o": 4.0,
    }
    weight = weights.get(model_name or "", 1.0)
    return max(1, int(round(tokens * weight)))


def _estimate_openai_cost_usd(
    model_name: Optional[str],
    input_tokens: int,
    output_tokens: int,
) -> Optional[float]:
    pricing_per_million = {
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "o4-mini": {"input": 1.0, "output": 4.0},
        "gpt-4o": {"input": 5.0, "output": 15.0},
    }
    if not model_name:
        return None
    rates = pricing_per_million.get(model_name)
    if not rates:
        return None
    cost = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
    return round(cost, 6)


def _estimate_whisper_cost_usd(audio_seconds: float) -> Optional[float]:
    if audio_seconds <= 0:
        return None
    cost_per_minute = 0.006
    return round((audio_seconds / 60.0) * cost_per_minute, 6)


def _estimate_vision_cost_usd(images: int) -> Optional[float]:
    if images <= 0:
        return None
    # Update with your current Google Vision pricing.
    per_image = 0.0015
    return round(images * per_image, 6)


def _log_usage_events(
    session: Session,
    owner_id: UUID,
    *,
    request_id: UUID,
    event_type: str,
    source: Optional[str],
    events: List[Dict[str, Any]],
    import_credits_used: Optional[int] = None,
) -> None:
    is_import_flow = event_type in {"import", "scan"}
    for event in events:
        provider = str(event.get("provider") or "")
        model = event.get("model")
        input_tokens = int(event.get("input_tokens") or 0)
        output_tokens = int(event.get("output_tokens") or 0)
        total_tokens = int(event.get("total_tokens") or 0)
        if total_tokens <= 0:
            total_tokens = max(0, input_tokens + output_tokens)
        tokens_weighted = _apply_token_weight(total_tokens, model) if provider == "openai" else 0
        ai_credits_used = tokens_weighted if provider == "openai" else 0
        import_credits_for_event = 0
        if is_import_flow and provider == "openai" and model != "whisper-1":
            import_credits_for_event = tokens_weighted
        cost_usd = None
        if provider == "openai":
            if model == "whisper-1":
                audio_seconds = float(event.get("audio_seconds") or 0)
                cost_usd = _estimate_whisper_cost_usd(audio_seconds)
            else:
                cost_usd = _estimate_openai_cost_usd(model, input_tokens, output_tokens)
        elif provider == "google-vision":
            images = int(event.get("images") or 0)
            cost_usd = _estimate_vision_cost_usd(images)

        session.add(
            UsageEvent(
                owner_id=owner_id,
                request_id=request_id,
                event_type=event_type,
                source=source,
                model_provider=provider or None,
                model_name=model,
                tokens_input=input_tokens,
                tokens_output=output_tokens,
                tokens_total=total_tokens,
                tokens_weighted=tokens_weighted,
                ai_credits_used=ai_credits_used,
                import_credits_used=import_credits_for_event,
                cost_usd=cost_usd,
                metadata_={
                    k: v
                    for k, v in event.items()
                    if k not in {"provider", "model", "input_tokens", "output_tokens", "total_tokens"}
                },
            )
        )

    if import_credits_used is not None and import_credits_used > 0:
        session.add(
            UsageEvent(
                owner_id=owner_id,
                request_id=request_id,
                event_type="import_credit",
                source=source,
                model_provider=None,
                model_name=None,
                tokens_input=0,
                tokens_output=0,
                tokens_total=0,
                tokens_weighted=0,
                ai_credits_used=0,
                import_credits_used=import_credits_used,
                cost_usd=None,
                metadata_={},
            )
        )

    session.commit()


def _increment_ai_usage(session: Session, owner_id: UUID, tokens: int) -> None:
    if tokens <= 0:
        return
    period_start = _get_period_start()
    existing = session.exec(
        select(UsageMonthly).where(
            UsageMonthly.owner_id == owner_id,
            UsageMonthly.period_start == period_start,
        )
    ).first()
    if existing:
        existing.ai_tokens += tokens
        existing.updated_at = datetime.utcnow()
    else:
        session.add(
            UsageMonthly(
                owner_id=owner_id,
                period_start=period_start,
                import_count=0,
                ai_tokens=tokens,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
    session.commit()


def _increment_import_usage(session: Session, owner_id: UUID, source: str) -> None:
    period_start = _get_period_start()
    usage = session.exec(
        select(UsageMonthly).where(
            UsageMonthly.owner_id == owner_id,
            UsageMonthly.period_start == period_start,
        )
    ).first()
    if usage:
        usage.import_count += 1
        usage.updated_at = datetime.utcnow()
    else:
        session.add(
            UsageMonthly(
                owner_id=owner_id,
                period_start=period_start,
                import_count=1,
                ai_tokens=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
    source_key = (source or "unknown").lower()
    source_usage = session.exec(
        select(ImportUsageMonthly).where(
            ImportUsageMonthly.owner_id == owner_id,
            ImportUsageMonthly.period_start == period_start,
            ImportUsageMonthly.source == source_key,
        )
    ).first()
    if source_usage:
        source_usage.import_count += 1
        source_usage.updated_at = datetime.utcnow()
    else:
        session.add(
            ImportUsageMonthly(
                owner_id=owner_id,
                period_start=period_start,
                source=source_key,
                import_count=1,
                updated_at=datetime.utcnow(),
            )
        )
    session.commit()


@router.get("/shopping-list", response_model=List[ShoppingListItemDTO])
def get_shopping_list_items(
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> List[ShoppingListItemDTO]:
    user_id = _resolve_user_id(x_user_email, x_user_id)
    items = session.exec(
        select(ShoppingListItem)
        .where(ShoppingListItem.user_id == user_id)
        .order_by(ShoppingListItem.created_at)
    ).all()
    return items


@router.put("/shopping-list", response_model=List[ShoppingListItemDTO])
def replace_shopping_list_items(
    payload: ShoppingListSyncDTO,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> List[ShoppingListItemDTO]:
    user_id = _resolve_user_id(x_user_email, x_user_id)
    existing_items = session.exec(
        select(ShoppingListItem).where(ShoppingListItem.user_id == user_id)
    ).all()
    for item in existing_items:
        session.delete(item)
    session.commit()

    now = datetime.utcnow()
    new_items: List[ShoppingListItem] = []
    for entry in payload.items:
        normalized_name = _normalize_text(entry.name)
        if not normalized_name:
            continue
        normalized_amount = _normalize_text(entry.amount)
        item = ShoppingListItem(
            id=entry.id or uuid4(),
            user_id=user_id,
            name=normalized_name,
            amount=normalized_amount,
            is_checked=bool(entry.is_checked),
            recipe_id=_normalize_text(entry.recipe_id),
            recipe_name=_normalize_text(entry.recipe_name),
            created_at=now,
            updated_at=now,
        )
        new_items.append(item)

    if new_items:
        session.add_all(new_items)
    session.commit()
    return new_items


@router.get("/collections", response_model=List[RecipeCollectionDTO])
def get_recipe_collections(
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> List[RecipeCollectionDTO]:
    user_id = _resolve_user_id(x_user_email, x_user_id)
    collections = session.exec(
        select(RecipeCollection)
        .where(RecipeCollection.owner_id == user_id)
        .order_by(RecipeCollection.created_at)
    ).all()
    if not collections:
        return []
    collection_ids = [collection.id for collection in collections]
    items = session.exec(
        select(RecipeCollectionItem).where(RecipeCollectionItem.collection_id.in_(collection_ids))
    ).all()
    item_map: Dict[UUID, List[UUID]] = {collection_id: [] for collection_id in collection_ids}
    for item in items:
        item_map.setdefault(item.collection_id, []).append(item.recipe_id)
    return [
        RecipeCollectionDTO(
            id=collection.id,
            name=collection.name,
            recipe_ids=item_map.get(collection.id, []),
            created_at=collection.created_at,
        )
        for collection in collections
    ]


@router.put("/collections", response_model=List[RecipeCollectionDTO])
def replace_recipe_collections(
    payload: RecipeCollectionsSyncDTO,
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    session: Session = Depends(get_db_session),
) -> List[RecipeCollectionDTO]:
    user_id = _resolve_user_id(x_user_email, x_user_id)
    existing = session.exec(
        select(RecipeCollection).where(RecipeCollection.owner_id == user_id)
    ).all()
    existing_ids = [collection.id for collection in existing]
    if existing_ids:
        existing_items = session.exec(
            select(RecipeCollectionItem).where(RecipeCollectionItem.collection_id.in_(existing_ids))
        ).all()
        for item in existing_items:
            session.delete(item)
        for collection in existing:
            session.delete(collection)
        session.commit()

    now = datetime.utcnow()
    new_collections: List[RecipeCollection] = []
    new_items: List[RecipeCollectionItem] = []

    for entry in payload.collections:
        normalized_name = _normalize_text(entry.name)
        if not normalized_name:
            continue
        collection_id = entry.id or uuid4()
        collection = RecipeCollection(
            id=collection_id,
            owner_id=user_id,
            name=normalized_name,
            created_at=entry.created_at or now,
        )
        new_collections.append(collection)
        for recipe_id in entry.recipe_ids:
            new_items.append(
                RecipeCollectionItem(
                    id=uuid4(),
                    collection_id=collection_id,
                    recipe_id=recipe_id,
                    created_at=now,
                )
            )

    if new_collections:
        session.add_all(new_collections)
    if new_items:
        session.add_all(new_items)
    session.commit()

    item_map: Dict[UUID, List[UUID]] = {collection.id: [] for collection in new_collections}
    for item in new_items:
        item_map.setdefault(item.collection_id, []).append(item.recipe_id)
    return [
        RecipeCollectionDTO(
            id=collection.id,
            name=collection.name,
            recipe_ids=item_map.get(collection.id, []),
            created_at=collection.created_at,
        )
        for collection in new_collections
    ]
