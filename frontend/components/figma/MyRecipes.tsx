'use client';

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Grid, List, Search, Heart, Clock, SlidersHorizontal, Edit3, Trash2, X } from "lucide-react";
import type { Recipe } from "@/types/figma";
import { PlaceholderThumbnail } from "@/components/placeholder-thumbnail";
import { getFriendlyDuration } from "@/lib/utils";

const TAG_FILTER_OPTIONS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
  "Appetizer",
  "Salad",
  "Soup",
  "Stew",
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Keto",
  "Low-Carb",
  "High-Protein",
  "Meat",
  "Poultry",
  "Seafood",
  "Spicy",
  "Quick",
  "Healthy",
  "Comfort Food",
  "BBQ",
  "Grill",
  "Side Dish",
  "Meal Prep",
  "Budget-Friendly",
  "Kids-Friendly",
  "One-Pot",
];

const SOURCE_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "pinterest", label: "Pinterest" },
  { value: "web", label: "Web" },
  { value: "voice", label: "Voice" },
  { value: "scan", label: "Scan" },
];

interface MyRecipesProps {
  recipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
  onRecipeEdit: (recipe: Recipe) => void;
  onRecipeDelete: (recipe: Recipe) => void;
  onRecipeToggleFavorite: (recipe: Recipe) => void;
  initialTag?: string | null;
  onClearInitialTag?: () => void;
}

export function MyRecipes({
  recipes,
  onRecipeSelect,
  onRecipeEdit,
  onRecipeDelete,
  onRecipeToggleFavorite,
  initialTag = null,
  onClearInitialTag,
}: MyRecipesProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedInitialTag = initialTag ?? "";
  const [showFilters, setShowFilters] = useState(Boolean(normalizedInitialTag));
  const [filters, setFilters] = useState({
    cookingTime: "",
    tag: normalizedInitialTag,
    favoritesOnly: false,
    source: "",
  });
  const [recipePendingDelete, setRecipePendingDelete] = useState<Recipe | null>(null);
  const previousInitialTagRef = useRef<string | null>(normalizedInitialTag || null);
  const hasActiveFilters = Boolean(
    filters.cookingTime || filters.tag || filters.favoritesOnly || filters.source
  );

  useEffect(() => {
    if (!normalizedInitialTag) {
      previousInitialTagRef.current = null;
      return;
    }
    if (normalizedInitialTag === previousInitialTagRef.current) {
      return;
    }
    setFilters((prev) => ({ ...prev, tag: normalizedInitialTag }));
    setShowFilters(true);
    previousInitialTagRef.current = normalizedInitialTag;
    onClearInitialTag?.();
  }, [normalizedInitialTag, onClearInitialTag]);

  const resetFilters = () => {
    setFilters({ cookingTime: "", tag: "", favoritesOnly: false, source: "" });
    previousInitialTagRef.current = null;
    onClearInitialTag?.();
  };

  const parseMinutesFromDuration = (value?: string | null): number | undefined => {
    if (!value) {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    const colonMatch = normalized.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (colonMatch) {
      const hours = Number.parseInt(colonMatch[1], 10);
      const minutes = Number.parseInt(colonMatch[2], 10);
      const seconds = colonMatch[3] ? Number.parseInt(colonMatch[3], 10) : 0;
      return hours * 60 + minutes + Math.round(seconds / 60);
    }
    const totalMinutes =
      (Number.parseFloat((normalized.match(/(\d+(?:[.,]\d+)?)\s*h/) ?? [])[1]?.replace(",", ".") ?? "0") || 0) * 60 +
      (Number.parseFloat((normalized.match(/(\d+(?:[.,]\d+)?)\s*m/) ?? [])[1]?.replace(",", ".") ?? "0") || 0);
    if (totalMinutes > 0) {
      return Math.round(totalMinutes);
    }
    const isoHours = normalized.match(/(\d+)h/);
    const isoMinutes = normalized.match(/(\d+)m/);
    if (isoHours || isoMinutes) {
      return (Number(isoHours?.[1]) || 0) * 60 + (Number(isoMinutes?.[1]) || 0);
    }
    const plainMatch = normalized.match(/(\d+)\s*(min|m|minutes?)/);
    if (plainMatch) {
      return Number.parseInt(plainMatch[1], 10);
    }
    const numeric = Number.parseInt(normalized, 10);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  const filteredRecipes = recipes.filter((recipe) => {
    const activeTag = filters.tag?.trim().toLowerCase();
    if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.favoritesOnly && !recipe.isFavorite) {
      return false;
    }
    if (activeTag) {
      const hasTag = (recipe.tags || []).some(
        (tag) => tag?.trim().toLowerCase() === activeTag
      );
      if (!hasTag) {
        return false;
      }
    }
    if (filters.source) {
      const recipeSource = recipe.source?.toLowerCase() ?? "";
      if (recipeSource !== filters.source) {
        return false;
      }
    }
    if (filters.cookingTime) {
      const minutes =
        parseMinutesFromDuration(recipe.totalTime) ??
        parseMinutesFromDuration(recipe.cookTime) ??
        parseMinutesFromDuration(recipe.prepTime) ??
        parseMinutesFromDuration(recipe.duration);
      if (!minutes) {
        return false;
      }
      if (filters.cookingTime === "quick" && minutes > 30) return false;
      if (filters.cookingTime === "medium" && (minutes <= 30 || minutes > 60)) return false;
      if (filters.cookingTime === "long" && minutes <= 60) return false;
    }
    return true;
  });

  const handleDeleteRequest = (recipe: Recipe) => {
    setRecipePendingDelete(recipe);
  };

  const handleConfirmDelete = () => {
    if (!recipePendingDelete) {
      return;
    }
    onRecipeDelete(recipePendingDelete);
    setRecipePendingDelete(null);
  };

  const handleCancelDelete = () => {
    setRecipePendingDelete(null);
  };

  return (
    <div className="min-h-screen bg-white pb-16">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl">My Recipes</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-gray-100" : "hover:bg-gray-100"
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "list" ? "bg-gray-100" : "hover:bg-gray-100"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search your recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors text-sm"
          />
        </div>

        {/* Filter Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Filters</span>
            {hasActiveFilters && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
          </button>
          {filters.tag && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-full text-xs">
              <span>{filters.tag}</span>
              <button
                type="button"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, tag: "" }));
                  previousInitialTagRef.current = null;
                  onClearInitialTag?.();
                }}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20"
                aria-label="Clear tag filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 max-h-[40vh] overflow-y-auto">
          <div className="flex justify-end mb-3">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-black"
              >
                <X className="w-3 h-3" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 mb-2 block">Cooking Time</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "", label: "All" },
                  { value: "quick", label: "Quick (<30 min)" },
                  { value: "medium", label: "Medium (30-60 min)" },
                  { value: "long", label: "Long (>60 min)" },
                ].map((time) => (
                  <button
                    key={time.value}
                    onClick={() => setFilters({ ...filters, cookingTime: time.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      filters.cookingTime === time.value
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {time.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-2 block">Tags</label>
              <div className="flex gap-2 flex-wrap">
                {["", ...TAG_FILTER_OPTIONS].map((tag) => (
                  <button
                    key={tag || "all"}
                    onClick={() => setFilters({ ...filters, tag })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      filters.tag === tag
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {tag || "All"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-2 block">Source</label>
              <div className="flex gap-2 flex-wrap">
                {SOURCE_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value || "all-sources"}
                    onClick={() => setFilters({ ...filters, source: option.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      filters.source === option.value
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="favoritesOnly"
                checked={filters.favoritesOnly}
                onChange={(event) => setFilters({ ...filters, favoritesOnly: event.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="favoritesOnly" className="text-sm text-gray-700">
                Favorites only
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Count */}
      <div className="px-6 py-4">
        <p className="text-xs text-gray-500">
          {filteredRecipes.length} {filteredRecipes.length === 1 ? "recipe" : "recipes"}
        </p>
      </div>

      {/* Recipes */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📚</span>
          </div>
          <h2 className="text-xl mb-2">No recipes yet</h2>
          <p className="text-gray-500 text-sm mb-6">
            Import your first recipe from TikTok or paste a URL
          </p>
        </div>
      ) : (
        <div className="px-6 pb-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 auto-rows:minmax(0, 1fr)">
              {filteredRecipes.map((recipe) => (
                <RecipeGridCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => onRecipeSelect(recipe)}
                  onEdit={() => onRecipeEdit(recipe)}
                  onDelete={() => handleDeleteRequest(recipe)}
                  onFavoriteToggle={() => onRecipeToggleFavorite(recipe)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecipes.map((recipe) => (
                <RecipeListCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => onRecipeSelect(recipe)}
                  onEdit={() => onRecipeEdit(recipe)}
                  onDelete={() => handleDeleteRequest(recipe)}
                  onFavoriteToggle={() => onRecipeToggleFavorite(recipe)}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {recipePendingDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Delete recipe?</h3>
              <p className="mt-2 text-sm text-gray-600">
                &ldquo;{recipePendingDelete.title}&rdquo; will be permanently removed from your recipes.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Keep recipe
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RecipeGridCardProps {
  recipe: Recipe;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavoriteToggle: () => void;
}

function RecipeGridCard({ recipe, onClick, onEdit, onDelete, onFavoriteToggle }: RecipeGridCardProps) {
  const friendlyDuration =
    getFriendlyDuration(recipe.totalTime, recipe.duration, recipe.cookTime, recipe.prepTime);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="text-left group flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-2">
        {recipe.thumbnail ? (
          <NextImage
            fill
            sizes="200px"
            src={recipe.thumbnail}
            alt={recipe.title}
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <PlaceholderThumbnail className="absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 shadow"
              aria-label="Edit recipe"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white shadow"
              aria-label="Delete recipe"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFavoriteToggle();
              }}
              className={`pointer-events-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium shadow ${
                recipe.isFavorite ? "bg-black/90 text-white" : "bg-white/90 text-gray-900"
              }`}
              aria-pressed={recipe.isFavorite}
              aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={`w-3.5 h-3.5 ${recipe.isFavorite ? "fill-current" : ""}`} />
              Favorite
            </button>
          </div>
        </div>
        {recipe.isFavorite && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Heart className="w-3 h-3 fill-black text-black" />
          </div>
        )}
        {friendlyDuration && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{friendlyDuration}</span>
          </div>
        )}
      </div>
      <h3 className="text-sm line-clamp-2 mb-0 min-h-[3rem]">{recipe.title}</h3>
    </div>
  );
}

interface RecipeListCardProps {
  recipe: Recipe;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavoriteToggle: () => void;
}

function RecipeListCard({ recipe, onClick, onEdit, onDelete, onFavoriteToggle }: RecipeListCardProps) {
  const friendlyDuration =
    getFriendlyDuration(recipe.totalTime, recipe.duration, recipe.cookTime, recipe.prepTime);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="relative w-full flex gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-all text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
    >
      <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
        {recipe.thumbnail ? (
          <NextImage
            fill
            sizes="64px"
            src={recipe.thumbnail}
            alt={recipe.title}
            className="object-cover"
          />
        ) : (
          <PlaceholderThumbnail className="absolute inset-0" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between h-16 py-0.5">
        <h3 className="text-sm leading-tight line-clamp-2">{recipe.title}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
          {friendlyDuration && (
            <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600">
              <Clock className="w-3 h-3" />
              <span className="tracking-tight">{friendlyDuration}</span>
            </div>
          )}
          {recipe.isFavorite && (
            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
              <Heart className="w-3 h-3 fill-black text-black" />
            </div>
          )}
        </div>
      </div>
      <div className="absolute inset-0 rounded-lg bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center"
          aria-label="Edit recipe"
        >
          <Edit3 className="w-4 h-4 text-gray-800" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="w-8 h-8 rounded-full bg-red-50 text-red-600 shadow flex items-center justify-center"
          aria-label="Delete recipe"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFavoriteToggle();
          }}
          className={`w-8 h-8 rounded-full shadow flex items-center justify-center ${
            recipe.isFavorite ? "bg-black text-white" : "bg-white text-gray-800"
          }`}
          aria-pressed={recipe.isFavorite}
          aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`w-4 h-4 ${recipe.isFavorite ? "fill-current" : ""}`} />
        </button>
      </div>
    </div>
  );
}
