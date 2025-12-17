from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel


class IngredientBase(SQLModel):
    line: str
    amount: Optional[str] = None
    name: Optional[str] = None


class InstructionBase(SQLModel):
    step_number: int
    text: str


class RecipeTagBase(SQLModel):
    name: str


class RecipeBase(SQLModel):
    title: str
    description: Optional[str] = None

    meal_type: Optional[str] = None
    difficulty: Optional[str] = None

    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    total_time: Optional[str] = None
    servings: Optional[str] = None

    nutrition_calories: Optional[str] = None
    nutrition_protein: Optional[str] = None
    nutrition_carbs: Optional[str] = None
    nutrition_fat: Optional[str] = None

    chef_notes: Optional[str] = None

    source_platform: str
    source_url: str
    source_domain: Optional[str] = None
    imported_at: datetime = Field(default_factory=datetime.utcnow)

    media_video_url: Optional[str] = None
    media_image_url: Optional[str] = None
    media_local_path: Optional[str] = None
    is_favorite: bool = Field(default=False, nullable=False)


class Ingredient(IngredientBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    recipe_id: UUID = Field(foreign_key="recipe.id", ondelete="CASCADE")

    recipe: "Recipe" = Relationship(back_populates="ingredients")


class InstructionStep(InstructionBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    recipe_id: UUID = Field(foreign_key="recipe.id", ondelete="CASCADE")

    recipe: "Recipe" = Relationship(back_populates="instructions")


class RecipeTag(RecipeTagBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    recipe_id: UUID = Field(foreign_key="recipe.id", ondelete="CASCADE")

    recipe: "Recipe" = Relationship(back_populates="tags")


class Recipe(RecipeBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)

    ingredients: List["Ingredient"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    instructions: List["InstructionStep"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: List["RecipeTag"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class UserSettings(SQLModel, table=True):
    user_id: UUID = Field(primary_key=True, index=True)
    country: Optional[str] = Field(default=None)
    unit_preference: str = Field(default="metric")
    language_preference: str = Field(default="en")
    notifications_enabled: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class ShoppingListItem(SQLModel, table=True):
    __tablename__ = "shopping_list_item"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    user_id: UUID = Field(index=True)
    name: str
    amount: Optional[str] = None
    is_checked: bool = Field(default=False, nullable=False)
    recipe_id: Optional[str] = None
    recipe_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
