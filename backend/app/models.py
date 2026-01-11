from datetime import datetime, date
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
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


class RecipeCollection(SQLModel, table=True):
    __tablename__ = "recipe_collections"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    owner_id: UUID = Field(index=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class RecipeCollectionItem(SQLModel, table=True):
    __tablename__ = "recipe_collection_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    collection_id: UUID = Field(foreign_key="recipe_collections.id", ondelete="CASCADE")
    recipe_id: UUID = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class UsageMonthly(SQLModel, table=True):
    __tablename__ = "usage_monthly"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    owner_id: UUID = Field(index=True)
    period_start: date = Field(index=True)
    import_count: int = Field(default=0)
    translations_count: int = Field(default=0)
    optimizations_count: int = Field(default=0)
    ai_messages_count: int = Field(default=0)
    ai_tokens: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class ImportUsageMonthly(SQLModel, table=True):
    __tablename__ = "import_usage_monthly"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    owner_id: UUID = Field(index=True)
    period_start: date = Field(index=True)
    source: str = Field(index=True)
    import_count: int = Field(default=0)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class UsageEvent(SQLModel, table=True):
    __tablename__ = "usage_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    owner_id: UUID = Field(index=True)
    request_id: Optional[UUID] = Field(default=None, index=True)
    event_type: str = Field(index=True)
    source: Optional[str] = Field(default=None, index=True)
    model_provider: Optional[str] = Field(default=None, index=True)
    model_name: Optional[str] = Field(default=None, index=True)
    tokens_input: int = Field(default=0)
    tokens_output: int = Field(default=0)
    tokens_total: int = Field(default=0)
    tokens_weighted: int = Field(default=0)
    ai_credits_used: int = Field(default=0)
    import_credits_used: int = Field(default=0)
    cost_usd: Optional[float] = Field(default=None)
    metadata_: dict = Field(default_factory=dict, sa_column=Column("metadata", JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class GlobalRecipe(SQLModel, table=True):
    __tablename__ = "global_recipes"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    source_url: str
    source_url_normalized: Optional[str] = Field(default=None, index=True)
    source_domain: Optional[str] = None
    source_platform: Optional[str] = None
    language_code: Optional[str] = None
    title: Optional[str] = None
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
    media_video_url: Optional[str] = None
    media_image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    ingredients: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    steps: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    quality_score: int = Field(default=0)
    is_complete: bool = Field(default=False)
    missing_fields: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    last_fetched_at: Optional[datetime] = None
    canonical_hash: Optional[str] = Field(default=None, index=True)
    canonical_group_id: Optional[UUID] = Field(default=None, index=True)
    supersedes_id: Optional[UUID] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

