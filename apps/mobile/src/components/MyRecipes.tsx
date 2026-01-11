import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Recipe, RecipeCollection, Screen } from "../data/types";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";
import { RecipeThumbnail } from "./RecipeThumbnail";
import { RECIPE_TAGS } from "../../../../packages/shared/constants/recipe-tags";
import { AddToCollectionModal } from "./AddToCollectionModal";
import { formatDuration } from "../utils/formatDuration";
import { EmptyState } from "./EmptyState";

interface MyRecipesProps {
  recipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
  onRecipeEdit: (recipe: Recipe) => void;
  onRecipeDelete: (recipe: Recipe) => void;
  onRecipeToggleFavorite: (recipe: Recipe) => void;
  onNavigate: (screen: Screen) => void;
  onAddManually: () => void;
  inboxCount?: number;
  importReadyCount?: number;
  initialTag?: string | null;
  onClearInitialTag?: () => void;
  collections?: RecipeCollection[];
  onCreateCollection?: (name: string, recipeId?: string) => void;
  onDeleteCollection?: (collectionId: string) => void;
  onAddToCollection?: (recipeId: string, collectionId: string) => void;
}

const TAG_FILTER_OPTIONS = RECIPE_TAGS.map((tag) => tag.toLowerCase());
const TAG_LABELS = new Map(
  RECIPE_TAGS.map((tag) => [tag.toLowerCase(), tag])
);
const MAX_TAG_FILTERS = 3;

const SOURCE_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "pinterest", label: "Pinterest" },
  { value: "web", label: "Web" },
  { value: "photo", label: "Scan" },
];

export const MyRecipes: React.FC<MyRecipesProps> = ({
  recipes,
  onRecipeSelect,
  onRecipeEdit,
  onRecipeDelete,
  onRecipeToggleFavorite,
  onNavigate,
  onAddManually,
  inboxCount = 0,
  importReadyCount = 0,
  initialTag = null,
  onClearInitialTag,
  collections = [],
  onCreateCollection,
  onDeleteCollection,
  onAddToCollection,
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.xl * 2 - spacing.md) / 2;
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewType, setViewType] = useState<"recipes" | "collections">("recipes");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedInitialTag = initialTag?.trim().toLowerCase() || "";
  const [showFilters, setShowFilters] = useState(false);
  const [showAllTagFilters, setShowAllTagFilters] = useState(false);
  const [filters, setFilters] = useState({
    tags: normalizedInitialTag ? [normalizedInitialTag] : ([] as string[]),
    favoritesOnly: false,
    source: "",
  });
  const [recipePendingDelete, setRecipePendingDelete] = useState<Recipe | null>(null);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [selectedRecipeForCollection, setSelectedRecipeForCollection] = useState<Recipe | null>(null);
  const [isAddRecipesOpen, setIsAddRecipesOpen] = useState(false);
  const [addRecipeSearch, setAddRecipeSearch] = useState("");
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionPendingDelete, setCollectionPendingDelete] = useState<RecipeCollection | null>(null);

  const hasActiveFilters = Boolean(filters.tags.length || filters.favoritesOnly || filters.source);
  const selectedCollection = selectedCollectionId
    ? collections.find((collection) => collection.id === selectedCollectionId) ?? null
    : null;
  const selectedCollectionRecipes = selectedCollection
    ? recipes.filter((recipe) => selectedCollection.recipeIds.includes(recipe.id))
    : [];
  const addRecipesResults = useMemo(
    () =>
      recipes.filter((recipe) =>
        recipe.title.toLowerCase().includes(addRecipeSearch.trim().toLowerCase())
      ),
    [addRecipeSearch, recipes]
  );
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((recipe) => {
      (recipe.tags || []).forEach((tag) => {
        const normalized = tag?.trim().toLowerCase();
        if (!normalized) return;
        if (!TAG_FILTER_OPTIONS.includes(normalized)) return;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
    });
    return counts;
  }, [recipes]);

  const visibleTagOptions = useMemo(
    () =>
      TAG_FILTER_OPTIONS.filter((tag) => (tagCounts.get(tag) ?? 0) > 0).sort((a, b) => {
        const countDiff = (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.localeCompare(b);
      }),
    [tagCounts]
  );
  const normalizeSource = (value?: string) => {
    const lower = value?.toLowerCase() ?? "";
    if (lower === "scan") return "photo";
    return lower;
  };
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((recipe) => {
      const normalized = normalizeSource(recipe.source);
      if (!normalized) return;
      const current = counts.get(normalized) ?? 0;
      counts.set(normalized, current + 1);
    });
    return counts;
  }, [recipes]);
  const visibleSourceOptions = useMemo(
    () =>
      SOURCE_FILTER_OPTIONS.filter(
        (option) => option.value === "" || (sourceCounts.get(option.value) ?? 0) > 0
      ),
    [sourceCounts]
  );

  useEffect(() => {
    if (!filters.source) return;
    if ((sourceCounts.get(filters.source) ?? 0) > 0) return;
    setFilters((prev) => ({ ...prev, source: "" }));
  }, [filters.source, sourceCounts]);

  const resetFilters = () => {
    setFilters({ tags: [], favoritesOnly: false, source: "" });
    onClearInitialTag?.();
  };

  const clearTagsFilter = () => {
    setFilters((prev) => ({ ...prev, tags: [] }));
    onClearInitialTag?.();
  };

  const toggleTagFilter = (tag: string) => {
    if (!tag) {
      clearTagsFilter();
      return;
    }
    const normalized = tag.toLowerCase();
    setFilters((prev) => {
      if (prev.tags.includes(normalized)) {
        return { ...prev, tags: prev.tags.filter((t) => t !== normalized) };
      }
      if (prev.tags.length >= MAX_TAG_FILTERS) {
        return prev;
      }
      return { ...prev, tags: [...prev.tags, normalized] };
    });
  };

  const handleTagChipPress = (tag: string) => {
    toggleTagFilter(tag);
    setShowFilters(false);
  };

  const shouldShowTagToggle = visibleTagOptions.length + 1 > 9;

  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        const activeTags = filters.tags;
        if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (filters.favoritesOnly && !recipe.isFavorite) {
          return false;
        }
        if (activeTags.length) {
          const recipeTags = (recipe.tags || []).map((tag) => tag?.trim().toLowerCase());
          const matchesAll = activeTags.every((tag) => recipeTags.includes(tag));
          if (!matchesAll) {
            return false;
          }
        }
        if (filters.source) {
          const recipeSource = normalizeSource(recipe.source);
          if (recipeSource !== filters.source) {
            return false;
          }
        }
        return true;
      }),
    [filters, recipes, searchQuery]
  );

  const getFriendlyDuration = (
    totalTime?: string,
    duration?: string,
    cookTime?: string,
    prepTime?: string
  ): string | null => {
    const time = totalTime || duration || cookTime || prepTime;
    if (!time) return null;

    const normalized = time.toLowerCase().trim();
    const hoursMatch = normalized.match(/(\d+)\s*h/);
    const minutesMatch = normalized.match(/(\d+)\s*m/);

    if (hoursMatch || minutesMatch) {
      const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
      const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
      if (hours && minutes) return `${hours}h ${minutes}m`;
      if (hours) return `${hours}h`;
      if (minutes) return `${minutes}m`;
    }
    return formatDuration(time);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>My Recipes</Text>
        </View>

        <View style={styles.viewTypeToggle}>
          <Pressable
            style={[styles.viewTypeButton, viewType === "recipes" ? styles.viewTypeActive : null]}
            onPress={() => {
              setViewType("recipes");
              setSelectedCollectionId(null);
            }}
          >
            <Text style={[styles.viewTypeText, viewType === "recipes" ? styles.viewTypeTextActive : null]}>
              All Recipes
            </Text>
          </Pressable>
          <Pressable
            style={[styles.viewTypeButton, viewType === "collections" ? styles.viewTypeActive : null]}
            onPress={() => {
              setViewType("collections");
              setSelectedCollectionId(null);
            }}
          >
            <Text style={[styles.viewTypeText, viewType === "collections" ? styles.viewTypeTextActive : null]}>
              Collections
            </Text>
          </Pressable>
        </View>

        {viewType === "recipes" && (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.gray400} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your recipes..."
              placeholderTextColor={colors.gray400}
              style={styles.searchInput}
            />
          </View>
        )}

        {viewType === "recipes" && (
          <View style={styles.filterBar}>
            <Pressable onPress={() => setShowFilters((prev) => !prev)} style={styles.filterButton}>
              <Ionicons name="options-outline" size={16} color={colors.gray900} />
              <Text style={styles.filterButtonText}>Filters</Text>
              {hasActiveFilters && <View style={styles.filterDot} />}
            </Pressable>
            {filters.tags.length ? (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {filters.tags.length === 1 ? filters.tags[0] : `${filters.tags.length} tags`}
                </Text>
                <Pressable
                  onPress={() => {
                    clearTagsFilter();
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.viewToggle}>
              <Pressable
                style={[styles.toggleButton, viewMode === "grid" ? styles.toggleActive : null]}
                onPress={() => setViewMode("grid")}
              >
                <Ionicons name="grid-outline" size={18} color={colors.gray900} />
              </Pressable>
              <Pressable
                style={[styles.toggleButton, viewMode === "list" ? styles.toggleActive : null]}
                onPress={() => setViewMode("list")}
              >
                <Ionicons name="list-outline" size={18} color={colors.gray900} />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {recipes.length === 0 && (
        <EmptyState
          variant="myRecipes"
          onImportFromLink={() => onNavigate?.("importFromLink")}
          onScanRecipe={() => onNavigate?.("scanRecipe")}
          onAddManually={() => onNavigate?.("import")}
          onCheckInbox={inboxCount > 0 && onNavigate ? () => onNavigate("importInbox") : undefined}
          inboxCount={inboxCount}
        />
      )}

      {showFilters && viewType === "recipes" && (
        <View style={styles.filterPanel}>
          <View style={styles.filterPanelHeader}>
            {hasActiveFilters ? (
              <Pressable onPress={resetFilters} style={styles.clearFilters}>
                <Ionicons name="close" size={14} color={colors.gray500} />
                <Text style={styles.clearFiltersText}>Clear all filters</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Tags</Text>
            {filters.tags.length > 0 && (
              <View style={styles.activeTagsRow}>
                {filters.tags.map((tag) => (
                  <View key={tag} style={styles.activeTagChip}>
                    <Text style={styles.activeTagText}>{TAG_LABELS.get(tag) ?? tag}</Text>
                    <Pressable onPress={() => toggleTagFilter(tag)}>
                      <Ionicons name="close" size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                <Pressable style={styles.clearTagsButton} onPress={clearTagsFilter}>
                  <Text style={styles.clearTagsText}>Clear tags</Text>
                </Pressable>
              </View>
            )}
            <View
              style={[
                styles.filterRow,
                !showAllTagFilters && shouldShowTagToggle && styles.filterRowCollapsed,
              ]}
            >
              {["", ...visibleTagOptions].map((tag) => {
                const isActive = tag ? filters.tags.includes(tag) : filters.tags.length === 0;
                const countLabel = tag ? ` (${tagCounts.get(tag) ?? 0})` : "";
                const label = tag ? TAG_LABELS.get(tag) ?? tag : "All";
                return (
                  <Pressable
                    key={tag || "all"}
                    onPress={() => handleTagChipPress(tag)}
                    style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                      {label}
                      {countLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {shouldShowTagToggle && (
              <Pressable
                style={styles.viewMoreButton}
                onPress={() => setShowAllTagFilters((prev) => !prev)}
              >
                <Text style={styles.viewMoreText}>
                  {showAllTagFilters ? "View fewer tags" : "View more tags"}
                </Text>
              </Pressable>
            )}
            {filters.tags.length >= MAX_TAG_FILTERS && (
              <Text style={styles.helperText}>Up to {MAX_TAG_FILTERS} tags can be combined.</Text>
            )}
          </View>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Source</Text>
            <View style={styles.filterRow}>
              {visibleSourceOptions.map((option) => (
                <Pressable
                  key={option.value || "all-sources"}
                  onPress={() => setFilters({ ...filters, source: option.value })}
                  style={[styles.filterChip, filters.source === option.value ? styles.filterChipActive : null]}
                >
                  <Text
                    style={[styles.filterChipText, filters.source === option.value ? styles.filterChipTextActive : null]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            style={styles.favoriteRow}
            onPress={() => setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
          >
            <View style={[styles.checkbox, filters.favoritesOnly ? styles.checkboxChecked : null]}>
              {filters.favoritesOnly && <Ionicons name="checkmark" size={14} color={colors.white} />}
            </View>
            <Text style={styles.favoriteLabel}>Favorites only</Text>
          </Pressable>
        </View>
      )}

      {viewType === "recipes" ? (
        recipes.length === 0 ? null : (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filteredRecipes.length} {filteredRecipes.length === 1 ? "recipe" : "recipes"}
          </Text>
        </View>
        )
      ) : selectedCollection ? (
        <View style={styles.collectionHeader}>
          <Pressable style={styles.collectionBack} onPress={() => setSelectedCollectionId(null)}>
            <Ionicons name="chevron-back" size={16} color={colors.gray700} />
            <Text style={styles.collectionBackText}>Back</Text>
          </Pressable>
          <View style={styles.collectionHeaderRow}>
            <View style={styles.collectionHeaderText}>
              <Text style={styles.collectionTitle}>{selectedCollection.name}</Text>
              <Text style={styles.collectionCount}>
                {selectedCollection.recipeIds.length} {selectedCollection.recipeIds.length === 1 ? "recipe" : "recipes"}
              </Text>
            </View>
            <Pressable style={styles.addRecipesButton} onPress={() => setIsAddRecipesOpen(true)}>
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.addRecipesText}>Add recipes</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.collectionToolbar}>
          <Text style={styles.collectionCountText}>
            {collections.length} {collections.length === 1 ? "collection" : "collections"}
          </Text>
          <Pressable style={styles.newCollectionButton} onPress={() => setShowCreateCollection(true)}>
            <Ionicons name="folder-open-outline" size={16} color={colors.white} />
            <Text style={styles.newCollectionText}>New Collection</Text>
          </Pressable>
        </View>
      )}

      {viewType === "recipes" ? (
        recipes.length === 0 ? null : filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyEmoji}>🔎</Text>
            </View>
            <Text style={styles.emptyTitle}>No matching recipes</Text>
            <Text style={styles.emptySubtitle}>Try clearing filters or search for something else.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {viewMode === "grid" ? (
              <View style={styles.grid}>
                {filteredRecipes.map((recipe) => {
                  const friendlyDuration = getFriendlyDuration(
                    recipe.totalTime,
                    recipe.duration,
                    recipe.cookTime,
                    recipe.prepTime
                  );
                  const isActive = activeRecipeId === recipe.id;
                  return (
                    <Pressable
                      key={recipe.id}
                      onPress={() => {
                        if (activeRecipeId === recipe.id) {
                          setActiveRecipeId(null);
                          return;
                        }
                        onRecipeSelect(recipe);
                      }}
                      onLongPress={() => setActiveRecipeId(recipe.id)}
                      style={[styles.gridCard, { width: cardWidth }]}
                    >
                      <View style={styles.gridImage}>
                        <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} style={styles.gridImage} />
                        {recipe.isFavorite && (
                          <View style={styles.favoriteBadge}>
                            <Ionicons name="heart" size={14} color={colors.gray900} />
                          </View>
                        )}
                        {friendlyDuration && (
                          <View style={styles.durationBadge}>
                            <Ionicons name="time-outline" size={12} color={colors.white} />
                            <Text style={styles.durationText}>{friendlyDuration}</Text>
                          </View>
                        )}
                        {isActive && (
                          <View style={styles.overlay}>
                            <View style={styles.overlayRow}>
                              <Pressable
                                style={styles.overlayButton}
                                onPress={() => onRecipeEdit(recipe)}
                              >
                                <Ionicons name="pencil" size={14} color={colors.gray900} />
                                <Text style={styles.overlayButtonText}>Edit</Text>
                              </Pressable>
                              {onAddToCollection && (
                                <Pressable
                                  style={styles.overlayButton}
                                  onPress={() => setSelectedRecipeForCollection(recipe)}
                                >
                                  <Ionicons name="folder-outline" size={14} color={colors.gray900} />
                                  <Text style={styles.overlayButtonText}>Add</Text>
                                </Pressable>
                              )}
                              <Pressable
                                style={[styles.overlayButton, styles.overlayDelete]}
                                onPress={() => setRecipePendingDelete(recipe)}
                              >
                                <Ionicons name="trash" size={14} color={colors.white} />
                                <Text style={[styles.overlayButtonText, styles.overlayDeleteText]}>Delete</Text>
                              </Pressable>
                            </View>
                            <Pressable
                              style={styles.overlayButton}
                              onPress={() => onRecipeToggleFavorite(recipe)}
                            >
                              <Ionicons
                                name={recipe.isFavorite ? "heart" : "heart-outline"}
                                size={14}
                                color={colors.gray900}
                              />
                              <Text style={styles.overlayButtonText}>Favorite</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                      <Text style={styles.gridTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.listStack}>
                {filteredRecipes.map((recipe) => {
                  const friendlyDuration = getFriendlyDuration(
                    recipe.totalTime,
                    recipe.duration,
                    recipe.cookTime,
                    recipe.prepTime
                  );
                  const isActive = activeRecipeId === recipe.id;
                  return (
                    <Pressable
                      key={recipe.id}
                      style={styles.listCard}
                      onPress={() => {
                        if (activeRecipeId === recipe.id) {
                          setActiveRecipeId(null);
                          return;
                        }
                        onRecipeSelect(recipe);
                      }}
                      onLongPress={() => setActiveRecipeId(recipe.id)}
                    >
                      <View style={styles.listThumb}>
                        <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} style={styles.listThumb} />
                      </View>
                      <View style={styles.listContent}>
                        <Text style={styles.listTitle} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                        <View style={styles.listMeta}>
                          {friendlyDuration && (
                            <View style={styles.metaChip}>
                              <Ionicons name="time-outline" size={12} color={colors.gray600} />
                              <Text style={styles.metaChipText}>{friendlyDuration}</Text>
                            </View>
                          )}
                          {recipe.isFavorite && (
                            <View style={styles.heartChip}>
                              <Ionicons name="heart" size={12} color={colors.gray900} />
                            </View>
                          )}
                        </View>
                      </View>
                      {isActive && (
                        <View style={styles.listActions}>
                          <Pressable style={styles.actionCircle} onPress={() => onRecipeEdit(recipe)}>
                            <Ionicons name="pencil" size={14} color={colors.gray800} />
                          </Pressable>
                          <Pressable style={[styles.actionCircle, styles.actionDelete]} onPress={() => setRecipePendingDelete(recipe)}>
                            <Ionicons name="trash" size={14} color={colors.red500} />
                          </Pressable>
                          {onAddToCollection && (
                            <Pressable
                              style={styles.actionCircle}
                              onPress={() => setSelectedRecipeForCollection(recipe)}
                            >
                              <Ionicons name="folder-outline" size={14} color={colors.purple600} />
                            </Pressable>
                          )}
                          <Pressable style={styles.actionCircle} onPress={() => onRecipeToggleFavorite(recipe)}>
                            <Ionicons
                              name={recipe.isFavorite ? "heart" : "heart-outline"}
                              size={14}
                              color={colors.gray900}
                            />
                          </Pressable>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )
      ) : (
        <View style={styles.collectionList}>
          {selectedCollection ? (
            selectedCollectionRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="folder-open-outline" size={26} color={colors.gray600} />
                </View>
                <Text style={styles.emptyTitle}>No recipes here yet</Text>
                <Text style={styles.emptySubtitle}>Add recipes to this collection from your recipe list.</Text>
              </View>
            ) : (
              <View style={styles.listStack}>
                {selectedCollectionRecipes.map((recipe) => {
                  const friendlyDuration = getFriendlyDuration(
                    recipe.totalTime,
                    recipe.duration,
                    recipe.cookTime,
                    recipe.prepTime
                  );
                  return (
                  <Pressable
                    key={recipe.id}
                    style={styles.listCard}
                    onPress={() => onRecipeSelect(recipe)}
                  >
                    <View style={styles.listThumb}>
                      <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} style={styles.listThumb} />
                    </View>
                    <View style={styles.listContent}>
                      <Text style={styles.listTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <View style={styles.listMeta}>
                        {friendlyDuration && (
                          <View style={styles.metaChip}>
                            <Ionicons name="time-outline" size={12} color={colors.gray600} />
                            <Text style={styles.metaChipText}>{friendlyDuration}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                  );
                })}
              </View>
            )
          ) : collections.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="folder-open-outline" size={26} color={colors.gray600} />
              </View>
              <Text style={styles.emptyTitle}>No collections yet</Text>
              <Text style={styles.emptySubtitle}>Create your first collection to organize recipes.</Text>
            </View>
          ) : (
            collections.map((collection) => (
              <Pressable
                key={collection.id}
                style={styles.collectionCard}
                onPress={() => setSelectedCollectionId(collection.id)}
              >
                <View style={styles.collectionIcon}>
                  <Ionicons name="folder-open" size={20} color={colors.white} />
                </View>
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionName}>{collection.name}</Text>
                  <Text style={styles.collectionMeta}>
                    {collection.recipeIds.length} {collection.recipeIds.length === 1 ? "recipe" : "recipes"}
                  </Text>
                </View>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setCollectionPendingDelete(collection);
                  }}
                  style={styles.collectionDelete}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.red500} />
                </Pressable>
              </Pressable>
            ))
          )}
        </View>
      )}

      <Modal transparent visible={Boolean(recipePendingDelete)} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete recipe?</Text>
            <Text style={styles.modalBody}>
              “{recipePendingDelete?.title}” will be permanently removed from your recipes. This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setRecipePendingDelete(null)}>
                <Text style={styles.modalSecondaryText}>Keep recipe</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryDanger}
                onPress={() => {
                  if (recipePendingDelete) {
                    onRecipeDelete(recipePendingDelete);
                    setRecipePendingDelete(null);
                  }
                }}
              >
                <Text style={styles.modalPrimaryText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={showCreateCollection} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Collection</Text>
            <TextInput
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="Collection name (e.g. Pasta Dishes)"
              placeholderTextColor={colors.gray400}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => {
                  setShowCreateCollection(false);
                  setNewCollectionName("");
                }}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, !newCollectionName.trim() && styles.modalPrimaryDisabled]}
                onPress={() => {
                  if (!newCollectionName.trim()) return;
                  onCreateCollection?.(newCollectionName.trim());
                  setShowCreateCollection(false);
                  setNewCollectionName("");
                }}
              >
                <Text style={styles.modalPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={Boolean(collectionPendingDelete)} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Collection?</Text>
            <Text style={styles.modalBody}>
              Are you sure you want to delete "{collectionPendingDelete?.name}"? This won't delete the recipes.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setCollectionPendingDelete(null)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryDanger}
                onPress={() => {
                  if (collectionPendingDelete) {
                    onDeleteCollection?.(collectionPendingDelete.id);
                    setCollectionPendingDelete(null);
                  }
                }}
              >
                <Text style={styles.modalPrimaryText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {selectedRecipeForCollection && onAddToCollection && onCreateCollection && (
        <AddToCollectionModal
          isOpen={Boolean(selectedRecipeForCollection)}
          onClose={() => setSelectedRecipeForCollection(null)}
          recipe={selectedRecipeForCollection}
          collections={collections}
          onAddToCollection={onAddToCollection}
          onCreateCollection={onCreateCollection}
        />
      )}
      {selectedCollection && onAddToCollection && (
        <Modal transparent visible={isAddRecipesOpen} animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.addRecipesCard}>
              <View style={styles.addRecipesHeader}>
                <Text style={styles.modalTitle}>Add recipes</Text>
                <Pressable onPress={() => setIsAddRecipesOpen(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={18} color={colors.gray600} />
                </Pressable>
              </View>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.gray400} />
                <TextInput
                  value={addRecipeSearch}
                  onChangeText={setAddRecipeSearch}
                  placeholder="Search recipes..."
                  placeholderTextColor={colors.gray400}
                  style={styles.searchInput}
                />
              </View>
              <ScrollView style={styles.addRecipesList}>
                {addRecipesResults.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="folder-open-outline" size={26} color={colors.gray600} />
                    </View>
                    <Text style={styles.emptyTitle}>No recipes found</Text>
                    <Text style={styles.emptySubtitle}>Try a different search.</Text>
                  </View>
                ) : (
                  addRecipesResults.map((recipe) => {
                    const isInCollection = selectedCollection.recipeIds.includes(recipe.id);
                    return (
                      <Pressable
                        key={recipe.id}
                        style={styles.addRecipeRow}
                        onPress={() => onAddToCollection(recipe.id, selectedCollection.id)}
                      >
                        <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} style={styles.addRecipeThumb} />
                        <View style={styles.addRecipeInfo}>
                          <Text style={styles.addRecipeTitle} numberOfLines={2}>
                            {recipe.title}
                          </Text>
                        </View>
                        <View style={[styles.addRecipeCheck, isInCollection && styles.addRecipeCheckActive]}>
                          {isInCollection && (
                            <Ionicons name="checkmark" size={14} color={colors.purple600} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <Pressable style={styles.doneButton} onPress={() => setIsAddRecipesOpen(false)}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  importSection: {
    paddingVertical: spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  viewToggle: {
    flexDirection: "row",
    gap: spacing.sm,
    marginLeft: "auto",
  },
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: colors.gray100,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.gray900,
  },
  viewTypeToggle: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 4,
  },
  viewTypeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  viewTypeActive: {
    backgroundColor: colors.gray900,
  },
  viewTypeText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  viewTypeTextActive: {
    color: colors.white,
    fontWeight: "600",
  },
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    minHeight: 44,
  },
  filterButtonText: {
    ...typography.bodySmall,
    color: colors.gray900,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
  },
  activeFilterText: {
    ...typography.caption,
    color: colors.white,
    textTransform: "capitalize",
  },
  filterPanel: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.gray50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    gap: spacing.lg,
  },
  filterPanelHeader: {
    alignItems: "flex-end",
  },
  clearFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  clearFiltersText: {
    ...typography.caption,
    color: colors.gray500,
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterLabel: {
    ...typography.captionBold,
    color: colors.gray600,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterRowCollapsed: {
    maxHeight: 44 * 3 + spacing.sm * 2,
    overflow: "hidden",
  },
  viewMoreButton: {
    alignSelf: "flex-start",
  },
  viewMoreText: {
    ...typography.caption,
    color: colors.gray600,
  },
  activeTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  activeTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
  },
  activeTagText: {
    ...typography.caption,
    color: colors.white,
    textTransform: "capitalize",
  },
  clearTagsButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  clearTagsText: {
    ...typography.caption,
    color: colors.gray600,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    minHeight: 44,
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: colors.gray900,
    borderColor: colors.gray900,
  },
  filterChipText: {
    ...typography.bodySmall,
    color: colors.gray700,
    textTransform: "capitalize",
  },
  filterChipTextActive: {
    color: colors.white,
  },
  helperText: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.gray900,
    borderColor: colors.gray900,
  },
  favoriteLabel: {
    ...typography.bodySmall,
    color: colors.gray700,
  },
  countRow: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  countText: {
    ...typography.caption,
    color: colors.gray500,
  },
  collectionToolbar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collectionCountText: {
    ...typography.caption,
    color: colors.gray500,
  },
  newCollectionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    minHeight: 44,
  },
  newCollectionText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  collectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  collectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  collectionHeaderText: {
    flex: 1,
    gap: 2,
  },
  collectionBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  collectionBackText: {
    ...typography.bodySmall,
    color: colors.gray700,
  },
  collectionTitle: {
    ...typography.h2,
    color: colors.gray900,
  },
  collectionCount: {
    ...typography.caption,
    color: colors.gray500,
  },
  addRecipesButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    minHeight: 44,
  },
  addRecipesText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "600",
  },
  collectionList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  collectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.white,
  },
  collectionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  collectionMeta: {
    ...typography.caption,
    color: colors.gray500,
  },
  collectionDelete: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridCard: {
    gap: spacing.sm,
  },
  gridImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  gridTitle: {
    ...typography.bodySmall,
    color: colors.gray900,
  },
  favoriteBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  durationText: {
    ...typography.caption,
    color: colors.white,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.md,
    justifyContent: "space-between",
  },
  overlayRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  overlayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  overlayButtonText: {
    ...typography.caption,
    color: colors.gray900,
  },
  overlayDelete: {
    backgroundColor: "rgba(220,38,38,0.9)",
  },
  overlayDeleteText: {
    color: colors.white,
  },
  listStack: {
    gap: spacing.md,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    minHeight: 88,
    backgroundColor: colors.white,
  },
  listThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  listContent: {
    flex: 1,
    gap: spacing.sm,
  },
  listTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
  },
  metaChipText: {
    ...typography.caption,
    color: colors.gray600,
  },
  heartChip: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  listActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  actionDelete: {
    backgroundColor: "#fef2f2",
    borderColor: "#fee2e2",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
  },
  emptyStateSimple: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
  },
  emptyInlineState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyInlineTitle: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyInlineSubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
  },
  emptyCard: {
    width: "100%",
    marginTop: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.xl,
    alignItems: "center",
    ...shadow.md,
  },
  emptyCardTitle: {
    ...typography.bodySmall,
    fontWeight: "500",
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.gray900,
  },
  modalBody: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    ...typography.bodySmall,
    color: colors.gray900,
    backgroundColor: colors.gray50,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalSecondary: {
    flex: 1,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  modalSecondaryText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  modalPrimaryDanger: {
    flex: 1,
    borderRadius: radius.full,
    backgroundColor: "#dc2626",
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  modalPrimaryDisabled: {
    backgroundColor: colors.gray200,
  },
  modalPrimaryText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  addRecipesCard: {
    width: "100%",
    maxHeight: "85%",
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.xl,
    gap: spacing.md,
  },
  addRecipesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
  },
  addRecipesList: {
    maxHeight: 360,
  },
  addRecipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  addRecipeThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  addRecipeInfo: {
    flex: 1,
  },
  addRecipeTitle: {
    ...typography.bodySmall,
    color: colors.gray900,
  },
  addRecipeCheck: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  addRecipeCheckActive: {
    borderColor: colors.purple600,
    backgroundColor: colors.purple100,
  },
  doneButton: {
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
});
