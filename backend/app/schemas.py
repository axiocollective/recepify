from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IngredientDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: Optional[UUID] = None
    line: str
    amount: Optional[str] = None
    name: Optional[str] = None


class InstructionStepDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: Optional[UUID] = None
    step_number: int = Field(alias="stepNumber")
    text: str


class RecipeBaseDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str
    description: Optional[str] = None
    meal_type: Optional[str] = Field(default=None, alias="mealType")
    difficulty: Optional[str] = None

    prep_time: Optional[str] = Field(default=None, alias="prepTime")
    cook_time: Optional[str] = Field(default=None, alias="cookTime")
    total_time: Optional[str] = Field(default=None, alias="totalTime")
    servings: Optional[str] = None

    nutrition_calories: Optional[str] = Field(default=None, alias="nutritionCalories")
    nutrition_protein: Optional[str] = Field(default=None, alias="nutritionProtein")
    nutrition_carbs: Optional[str] = Field(default=None, alias="nutritionCarbs")
    nutrition_fat: Optional[str] = Field(default=None, alias="nutritionFat")

    chef_notes: Optional[str] = Field(default=None, alias="chefNotes")

    source_platform: str = Field(alias="sourcePlatform")
    source_url: str = Field(alias="sourceUrl")
    source_domain: Optional[str] = Field(default=None, alias="sourceDomain")
    imported_at: Optional[datetime] = Field(default=None, alias="importedAt")

    media_video_url: Optional[str] = Field(default=None, alias="mediaVideoUrl")
    media_image_url: Optional[str] = Field(default=None, alias="mediaImageUrl")
    media_local_path: Optional[str] = Field(default=None, alias="mediaLocalPath")
    is_favorite: bool = Field(default=False, alias="isFavorite")


class RecipeCreateDTO(RecipeBaseDTO):
    ingredients: List[IngredientDTO] = Field(default_factory=list)
    instructions: List[InstructionStepDTO] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class RecipeReadDTO(RecipeBaseDTO):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: UUID
    ingredients: List[IngredientDTO]
    instructions: List[InstructionStepDTO]
    tags: List[str]


class UserSettingsBaseDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    country: Optional[str] = None
    unit_preference: Literal["metric", "us"] = Field(default="metric", alias="unitPreference")


class UserSettingsReadDTO(UserSettingsBaseDTO):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    user_id: UUID = Field(alias="userId")
    language_preference: Literal["en", "de"] = Field(default="en", alias="languagePreference")
    notifications_enabled: bool = Field(default=True, alias="notificationsEnabled")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class UserSettingsUpdateDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    country: Optional[str] = None
    unit_preference: Optional[Literal["metric", "us"]] = Field(default=None, alias="unitPreference")
    language_preference: Optional[Literal["en", "de"]] = Field(
        default=None, alias="languagePreference"
    )
    notifications_enabled: Optional[bool] = Field(default=None, alias="notificationsEnabled")


class ShoppingListItemDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: Optional[UUID] = None
    name: str
    amount: Optional[str] = None
    is_checked: bool = Field(default=False, alias="isChecked")
    recipe_id: Optional[str] = Field(default=None, alias="recipeId")
    recipe_name: Optional[str] = Field(default=None, alias="recipeName")


class ShoppingListSyncDTO(BaseModel):
    items: List[ShoppingListItemDTO] = Field(default_factory=list)


class RecipeCollectionDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: Optional[UUID] = None
    name: str
    recipe_ids: List[UUID] = Field(default_factory=list, alias="recipeIds")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")


class RecipeCollectionsSyncDTO(BaseModel):
    collections: List[RecipeCollectionDTO] = Field(default_factory=list)
