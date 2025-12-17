from __future__ import annotations

import json
import re

import logging
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from ..config import get_settings
from ..dependencies import get_db_session
from ..models import Ingredient, InstructionStep, Recipe, RecipeTag, ShoppingListItem, UserSettings
from ..schemas import (
    IngredientDTO,
    InstructionStepDTO,
    RecipeCreateDTO,
    RecipeReadDTO,
    UserSettingsReadDTO,
    UserSettingsUpdateDTO,
    ShoppingListItemDTO,
    ShoppingListSyncDTO,
)
from ..services import import_instagram as instagram_service
from ..services import import_scan as scan_service
from ..services import import_pinterest as pinterest_service
from ..services import import_tiktok as tiktok_service
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
) -> AssistantStructuredResponse:
    last_error: Optional[Exception] = None

    def invoke(messages: List[Dict[str, str]], model_name: str) -> Optional[AssistantStructuredResponse]:
        nonlocal last_error
        try:
            response = client.responses.parse(
                model=model_name,
                input=messages,
                text_format=AssistantStructuredResponse,
            )
            return response.output_parsed
        except Exception as exc:
            last_error = exc
            logger.warning("ChefGPT model %s failed to respond: %s", model_name, exc)
            return None

    def try_models(messages: List[Dict[str, str]]) -> Optional[AssistantStructuredResponse]:
        for model_name in CHEFGPT_MODEL_CANDIDATES:
            structured = invoke(messages, model_name)
            if structured:
                return structured
        return None

    structured = try_models(conversation)
    if structured:
        return structured

    retry_conversation = conversation + [
        {"role": "user", "content": SCHEMA_CORRECTION_PROMPT},
    ]
    structured = try_models(retry_conversation)
    if structured:
        return structured

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
    )


def _generate_plain_assistant_response(client: Any, conversation: List[Dict[str, str]]) -> str:
    last_error: Optional[Exception] = None
    for model_name in CHEFGPT_MODEL_CANDIDATES or ("gpt-4o-mini",):
        try:
            response = client.responses.create(
                model=model_name,
                input=conversation,
            )
            text = _extract_assistant_text(response)
            if text:
                return text
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
def import_web(payload: ImportRequest) -> ImportResponse:
    try:
        recipe_data = web_service.import_web(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    return ImportResponse(recipe=recipe_data)


@router.post("/import/tiktok", response_model=ImportResponse)
def import_tiktok(payload: ImportRequest) -> ImportResponse:
    try:
        recipe_data, video_path = tiktok_service.import_tiktok(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    return ImportResponse(recipe=recipe_data, videoPath=video_path)


@router.post("/import/instagram", response_model=ImportResponse)
def import_instagram(payload: ImportRequest) -> ImportResponse:
    try:
        recipe_data, video_path = instagram_service.import_instagram(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    return ImportResponse(recipe=recipe_data, videoPath=video_path)


@router.post("/import/pinterest", response_model=ImportResponse)
def import_pinterest(payload: ImportRequest) -> ImportResponse:
    try:
        recipe_data = pinterest_service.import_pinterest(payload.url)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    return ImportResponse(recipe=recipe_data)


@router.post("/import/scan", response_model=ImportResponse)
async def import_scan(file: UploadFile = File(...)) -> ImportResponse:
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")
    try:
        recipe_data = scan_service.import_scan(contents, file.filename, file.content_type)
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return ImportResponse(recipe=recipe_data)



@router.post("/assistant/recipe", response_model=RecipeAssistantResponse)
def recipe_assistant(payload: RecipeAssistantRequest) -> RecipeAssistantResponse:
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

    if payload.structured:
        structured_response = _generate_structured_sections_response(client, conversation)
        reply_payload = json.dumps(structured_response.model_dump())
    else:
        reply_payload = _generate_plain_assistant_response(client, conversation)
    return RecipeAssistantResponse(reply=reply_payload)


@router.post("/assistant/finder", response_model=RecipeFinderResponse)
def recipe_finder(payload: RecipeFinderRequest) -> RecipeFinderResponse:
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


@router.get("/shopping-list", response_model=List[ShoppingListItemDTO])
def get_shopping_list_items(
    session: Session = Depends(get_db_session),
) -> List[ShoppingListItemDTO]:
    items = session.exec(
        select(ShoppingListItem)
        .where(ShoppingListItem.user_id == DEFAULT_USER_ID)
        .order_by(ShoppingListItem.created_at)
    ).all()
    return items


@router.put("/shopping-list", response_model=List[ShoppingListItemDTO])
def replace_shopping_list_items(
    payload: ShoppingListSyncDTO,
    session: Session = Depends(get_db_session),
) -> List[ShoppingListItemDTO]:
    existing_items = session.exec(
        select(ShoppingListItem).where(ShoppingListItem.user_id == DEFAULT_USER_ID)
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
            user_id=DEFAULT_USER_ID,
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
