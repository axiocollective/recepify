'use client';

import NextImage from "next/image";
import { useState } from "react";
import { Search as SearchIcon, SlidersHorizontal, X, Clock, Heart } from "lucide-react";
import type { Recipe } from "@/types/figma";

const TAG_FILTER_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Keto",
  "Low-Carb",
  "High-Protein",
  "Spicy",
  "Quick",
  "Healthy",
  "Comfort Food",
  "Meal Prep",
  "Budget-Friendly",
  "Kids-Friendly",
  "One-Pot",
];

interface SearchProps {
  recipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
}

export function Search({ recipes, onRecipeSelect }: SearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    mealType: "",
    tag: "",
    source: "",
    favoritesOnly: false,
  });

  const filteredRecipes = recipes.filter((recipe) => {
    if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.favoritesOnly && !recipe.isFavorite) {
      return false;
    }
    if (filters.source && recipe.source !== filters.source) {
      return false;
    }
    if (filters.mealType && recipe.category !== filters.mealType) {
      return false;
    }
    if (filters.tag && !(recipe.tags || []).includes(filters.tag)) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 space-y-3">
        <h1 className="text-xl">Search</h1>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Filters</span>
          {Object.values(filters).some((v) => v) && (
            <span className="w-1.5 h-1.5 bg-black rounded-full" />
          )}
        </button>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {/* Meal Type */}
            <div>
              <label className="text-xs text-gray-600 mb-2 block">Meal Type</label>
              <div className="flex gap-2 flex-wrap">
                {["", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilters({ ...filters, mealType: type })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      filters.mealType === type
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {type || "All"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
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

            {/* Source */}
            <div>
              <label className="text-xs text-gray-600 mb-2 block">Source</label>
              <div className="flex gap-2 flex-wrap">
                {["", "tiktok", "instagram", "pinterest", "web", "voice"].map((source) => (
                  <button
                    key={source}
                    onClick={() => setFilters({ ...filters, source })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors capitalize ${
                      filters.source === source
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {source || "All"}
                  </button>
                ))}
              </div>
            </div>

            {/* Favorites Only */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <input
                type="checkbox"
                id="favoritesOnly"
                checked={filters.favoritesOnly}
                onChange={(e) =>
                  setFilters({ ...filters, favoritesOnly: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="favoritesOnly" className="text-xs">
                Favorites only
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() =>
                  setFilters({
                    mealType: "",
                    tag: "",
                    source: "",
                    favoritesOnly: false,
                  })
                }
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors text-sm"
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-6 py-6">
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SearchIcon className="w-7 h-7 text-gray-400" />
            </div>
            <h2 className="text-xl mb-2">No recipes found</h2>
            <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              {filteredRecipes.length} {filteredRecipes.length === 1 ? "recipe" : "recipes"}
            </p>
            <div className="space-y-3">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => onRecipeSelect(recipe)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-all text-left"
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
          <div className="absolute inset-0 bg-gray-200" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm mb-1 line-clamp-2">{recipe.title}</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
          {recipe.duration && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{recipe.duration}</span>
            </div>
          )}
          {recipe.isFavorite && <Heart className="w-3 h-3 fill-black text-black" />}
        </div>
        {recipe.tags && (
          <div className="flex gap-1 flex-wrap">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
