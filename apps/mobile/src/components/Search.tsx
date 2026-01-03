import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Recipe } from "../data/types";
import { colors, radius, spacing, typography } from "../theme/theme";
import { RecipeThumbnail } from "./RecipeThumbnail";
import { formatDuration } from "../utils/formatDuration";

interface SearchProps {
  recipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
}

export const Search: React.FC<SearchProps> = ({ recipes, onRecipeSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    mealType: "",
    difficulty: "",
    cookingTime: "",
    dietary: "",
    source: "",
    favoritesOnly: false,
  });

  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (filters.favoritesOnly && !recipe.isFavorite) {
          return false;
        }
        if (filters.source && recipe.source !== filters.source) {
          return false;
        }
        if (filters.difficulty && recipe.difficulty !== filters.difficulty) {
          return false;
        }
        if (filters.mealType && recipe.category !== filters.mealType) {
          return false;
        }
        if (filters.dietary && !(recipe.tags || []).includes(filters.dietary)) {
          return false;
        }
        if (filters.cookingTime) {
          const totalTime = recipe.totalTime || recipe.cookTime || "";
          const minutes = parseInt(totalTime, 10);
          if (filters.cookingTime === "quick" && minutes > 30) return false;
          if (filters.cookingTime === "medium" && (minutes <= 30 || minutes > 60)) return false;
          if (filters.cookingTime === "long" && minutes <= 60) return false;
        }
        return true;
      }),
    [filters, recipes, searchQuery]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Search</Text>
          <Pressable onPress={() => setShowFilters((prev) => !prev)} style={styles.filterButton}>
            <Ionicons name="options-outline" size={14} color={colors.gray900} />
            <Text style={styles.filterText}>Filters</Text>
            {Object.values(filters).some((value) => value) && <View style={styles.filterDot} />}
          </Pressable>
        </View>
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
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Meal Type</Text>
            <View style={styles.filterRow}>
              {["", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer"].map((type) => (
                <Pressable
                  key={type || "all"}
                  onPress={() => setFilters({ ...filters, mealType: type })}
                  style={[styles.filterChip, filters.mealType === type ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, filters.mealType === type ? styles.filterChipTextActive : null]}>
                    {type || "All"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Difficulty</Text>
            <View style={styles.filterRow}>
              {["", "easy", "medium", "hard"].map((level) => (
                <Pressable
                  key={level || "all"}
                  onPress={() => setFilters({ ...filters, difficulty: level })}
                  style={[styles.filterChip, filters.difficulty === level ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, filters.difficulty === level ? styles.filterChipTextActive : null]}>
                    {level || "All"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Cooking Time</Text>
            <View style={styles.filterRow}>
              {[
                { value: "", label: "All" },
                { value: "quick", label: "Quick (<30 min)" },
                { value: "medium", label: "Medium (30-60 min)" },
                { value: "long", label: "Long (>60 min)" },
              ].map((time) => (
                <Pressable
                  key={time.value || "all"}
                  onPress={() => setFilters({ ...filters, cookingTime: time.value })}
                  style={[styles.filterChip, filters.cookingTime === time.value ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, filters.cookingTime === time.value ? styles.filterChipTextActive : null]}>
                    {time.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Dietary</Text>
            <View style={styles.filterRow}>
              {["", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Low-Carb", "Paleo"].map((diet) => (
                <Pressable
                  key={diet || "all"}
                  onPress={() => setFilters({ ...filters, dietary: diet })}
                  style={[styles.filterChip, filters.dietary === diet ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, filters.dietary === diet ? styles.filterChipTextActive : null]}>
                    {diet || "All"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Source</Text>
            <View style={styles.filterRow}>
              {["", "tiktok", "instagram", "pinterest", "web", "photo"].map((source) => (
                <Pressable
                  key={source || "all"}
                  onPress={() => setFilters({ ...filters, source })}
                  style={[styles.filterChip, filters.source === source ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, filters.source === source ? styles.filterChipTextActive : null]}>
                    {source
                      ? source === "photo"
                        ? "Scan"
                        : source.charAt(0).toUpperCase() + source.slice(1)
                      : "All"}
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

          <View style={styles.filterActions}>
            <Pressable
              style={styles.filterReset}
              onPress={() =>
                setFilters({
                  mealType: "",
                  difficulty: "",
                  cookingTime: "",
                  dietary: "",
                  source: "",
                  favoritesOnly: false,
                })
              }
            >
              <Text style={styles.filterResetText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.filterApply} onPress={() => setShowFilters(false)}>
              <Text style={styles.filterApplyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.results}>
        {filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={28} color={colors.gray400} />
            </View>
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultCount}>
              {filteredRecipes.length} {filteredRecipes.length === 1 ? "recipe" : "recipes"}
            </Text>
            <View style={styles.resultsList}>
              {filteredRecipes.map((recipe) => (
                <Pressable key={recipe.id} style={styles.resultCard} onPress={() => onRecipeSelect(recipe)}>
                  <View style={styles.resultThumb}>
                    <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} />
                  </View>
                  <View style={styles.resultContent}>
                    <Text style={styles.resultTitle} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    <View style={styles.resultMeta}>
                      {(() => {
                        const duration = formatDuration(recipe.duration);
                        if (!duration) return null;
                        return (
                        <View style={styles.metaItem}>
                          <Ionicons name="time-outline" size={12} color={colors.gray500} />
                          <Text style={styles.metaText}>{duration}</Text>
                        </View>
                        );
                      })()}
                      {recipe.isFavorite && <Ionicons name="heart" size={12} color={colors.gray900} />}
                    </View>
                    {recipe.tags && recipe.tags.length > 0 ? (
                      <View style={styles.tagRow}>
                        {recipe.tags.slice(0, 3).map((tag) => (
                          <View key={tag} style={styles.tagChip}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    ...typography.h2,
    color: colors.gray900,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.gray900,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
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
    ...typography.bodySmall,
    color: colors.gray900,
  },
  filterPanel: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.gray50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    gap: spacing.lg,
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterLabel: {
    ...typography.caption,
    color: colors.gray600,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.gray700,
    textTransform: "capitalize",
  },
  filterChipTextActive: {
    color: colors.white,
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  favoriteLabel: {
    ...typography.caption,
    color: colors.gray700,
  },
  filterActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  filterReset: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  filterResetText: {
    ...typography.caption,
    color: colors.gray700,
  },
  filterApply: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.black,
    alignItems: "center",
  },
  filterApplyText: {
    ...typography.caption,
    color: colors.white,
  },
  results: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  resultCount: {
    ...typography.caption,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  resultsList: {
    gap: spacing.md,
  },
  resultCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  resultThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    ...typography.bodySmall,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.gray500,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
  },
  tagText: {
    ...typography.caption,
    color: colors.gray600,
  },
});
