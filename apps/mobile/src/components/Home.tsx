import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";
import { Recipe, RecipeCollection, Screen } from "../data/types";
import { RecipeThumbnail } from "./RecipeThumbnail";
import { formatDuration } from "../utils/formatDuration";
import { ImportQuickActions } from "./ImportQuickActions";

interface HomeProps {
  onNavigate: (screen: Screen) => void;
  onQuickTagSelect: (tag: string) => void;
  onAddManually: () => void;
  importQueueCount: number;
  recentRecipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
  allRecipes: Recipe[];
  inboxCount?: number;
  importReadyCount?: number;
  userName: string;
  aiDisabled: boolean;
  simulateEmptyState: boolean;
  collections: RecipeCollection[];
}

const homeTagOptions: Array<{ tag: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { tag: "quick", label: "Quick", icon: "flash-outline" },
  { tag: "under 30 minutes", label: "Under 30 Min", icon: "time-outline" },
  { tag: "breakfast", label: "Breakfast", icon: "cafe-outline" },
  { tag: "lunch", label: "Lunch", icon: "fast-food-outline" },
  { tag: "dinner", label: "Dinner", icon: "restaurant-outline" },
  { tag: "snack", label: "Snack", icon: "nutrition-outline" },
  { tag: "vegetarian", label: "Vegetarian", icon: "leaf-outline" },
  { tag: "vegan", label: "Vegan", icon: "leaf" },
  { tag: "healthy", label: "Healthy", icon: "heart-outline" },
  { tag: "spicy", label: "Spicy", icon: "flame-outline" },
  { tag: "soup", label: "Soup", icon: "water-outline" },
  { tag: "pasta", label: "Pasta", icon: "pizza-outline" },
];
const homeTagLookup = new Set(homeTagOptions.map((option) => option.tag));

export const Home: React.FC<HomeProps> = ({
  onNavigate,
  onQuickTagSelect,
  onAddManually,
  recentRecipes,
  onRecipeSelect,
  allRecipes,
  inboxCount,
  importReadyCount = 0,
  userName,
  aiDisabled: _aiDisabled,
  simulateEmptyState,
  collections,
}) => {
  const { width } = useWindowDimensions();
  const safeRecipes = Array.isArray(allRecipes) ? allRecipes : [];
  const hasRecipes = !simulateEmptyState && safeRecipes.length > 0;
  const showImportReady = !simulateEmptyState && importReadyCount > 0;

  const greeting = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const name = userName?.trim() || "there";

    if (!hasRecipes) {
      return { title: `Welcome ${name}` };
    }

    if (minutes >= 330 && minutes < 630) {
      return { title: `Good morning ${name}` };
    }
    if (minutes >= 630 && minutes < 720) {
      return { title: `Hey there ${name}` };
    }
    if (minutes >= 720 && minutes < 840) {
      return { title: `Lunch time ${name}` };
    }
    if (minutes >= 840 && minutes < 1020) {
      return { title: `Afternoon cravings ${name}?` };
    }
    if (minutes >= 1020 && minutes < 1140) {
      return { title: `Dinner time ${name}?` };
    }
    if (minutes >= 1140 && minutes < 1320) {
      return { title: `Evening vibes ${name}?` };
    }
    return { title: `Still awake ${name}?` };
  };

  const favorites = safeRecipes.filter((recipe) => recipe.isFavorite);
  const todaysPicks = useMemo(() => {
    const sorted = [...safeRecipes].sort((a, b) => {
      const aDate = a.addedDate ? a.addedDate.getTime() : 0;
      const bDate = b.addedDate ? b.addedDate.getTime() : 0;
      return bDate - aDate;
    });
    return sorted.slice(0, 3);
  }, [safeRecipes]);

  const homeTags = useMemo(() => {
    const counts = new Map<string, number>();
    safeRecipes.forEach((recipe) => {
      const tags = new Set((recipe.tags || []).map((tag) => tag.trim().toLowerCase()));
      tags.forEach((tag) => {
        if (homeTagLookup.has(tag)) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      });
    });
    return homeTagOptions
      .filter((option) => counts.has(option.tag))
      .sort((a, b) => {
        const countDiff = (counts.get(b.tag) ?? 0) - (counts.get(a.tag) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 6);
  }, [safeRecipes]);
  const tagCount = homeTags?.length ?? 0;
  const tagColumns = tagCount >= 3 ? 3 : tagCount || 1;
  const tagChipWidth =
    (width - spacing.xl * 2 - spacing.lg * (tagColumns - 1)) / tagColumns;

  const collectionsPreview = useMemo(() => {
    return [...collections]
      .sort((a, b) => b.recipeIds.length - a.recipeIds.length)
      .slice(0, 4)
      .map((collection) => {
        const thumbnails = collection.recipeIds
          .map((id) => allRecipes.find((recipe) => recipe.id === id)?.thumbnail)
          .filter((thumb): thumb is string => Boolean(thumb))
          .slice(0, 4);
        return { collection, thumbnails };
      });
  }, [collections, allRecipes]);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 128 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{greeting().title}</Text>
          <Text style={styles.headerSubtitle}>
            {hasRecipes ? "What would you like to cook today?" : "Let's add your first recipe"}
          </Text>
        </View>

        {!hasRecipes && (
          <View style={styles.section}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="book-outline" size={36} color={colors.gray400} />
              </View>
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptySubtitle}>
                Use the Add Recipe options below to import from links, social, or scan a recipe.
              </Text>
            </View>
            <ImportQuickActions
              onNavigate={onNavigate}
              onAddManually={onAddManually}
              inboxCount={inboxCount}
              importReadyCount={importReadyCount}
            />
          </View>
        )}

        {hasRecipes && homeTags.length > 0 && (
          <View style={styles.tagGridSection}>
            <View style={[styles.tagGrid, homeTags.length <= 2 && styles.tagGridCompact]}>
              {homeTags.map((tag) => (
                <Pressable
                  key={tag.tag}
                  style={({ pressed }) => [
                    styles.tagChip,
                    { width: tagChipWidth },
                    pressed ? styles.tagChipPressed : null,
                  ]}
                  onPress={() => onQuickTagSelect(tag.tag)}
                >
                  <View style={styles.tagIcon}>
                    <Ionicons name={tag.icon} size={22} color={colors.gray700} />
                  </View>
                  <Text style={styles.tagLabel} numberOfLines={2}>
                    {tag.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {showImportReady && (
          <View style={styles.section}>
            <Pressable onPress={() => onNavigate("importInbox")} style={styles.importReadyCard}>
              <LinearGradient
                colors={["#a855f7", "#9333ea"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.importReadyGradient}
              >
                <View style={styles.importReadyIcon}>
                  <Ionicons name="mail-open-outline" size={18} color={colors.white} />
                  <View style={styles.importReadyBadge}>
                    <Text style={styles.importReadyBadgeText}>{importReadyCount}</Text>
                  </View>
                </View>
                <View style={styles.importReadyContent}>
                  <Text style={styles.importReadyTitle}>{importReadyCount} New Recipes Ready</Text>
                  <Text style={styles.importReadySubtitle}>Tap to review and save to your collection</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {hasRecipes && collectionsPreview.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Collections</Text>
              <Pressable onPress={() => onNavigate("myRecipes")} style={styles.sectionActionButton}>
                <Text style={styles.sectionAction}>View all</Text>
              </Pressable>
            </View>
            <View style={styles.collectionsGrid}>
              {collectionsPreview.map(({ collection, thumbnails }) => (
                <Pressable
                  key={collection.id}
                  style={styles.collectionCard}
                  onPress={() => onNavigate("myRecipes")}
                >
                  <View style={styles.collectionThumbGrid}>
                    {[0, 1, 2, 3].map((index) => {
                      const thumb = thumbnails[index];
                      return thumb ? (
                        <RecipeThumbnail
                          key={thumb}
                          imageUrl={thumb}
                          title={collection.name}
                          style={styles.collectionThumb}
                        />
                      ) : (
                        <View key={`placeholder-${index}`} style={styles.collectionThumbPlaceholder} />
                      );
                    })}
                  </View>
                  <Text style={styles.collectionName} numberOfLines={1}>
                    {collection.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {hasRecipes && todaysPicks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Picks</Text>
              <Pressable onPress={() => onNavigate("myRecipes")} style={styles.sectionActionButton}>
                <Text style={styles.sectionAction}>View all</Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {todaysPicks.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onPress={() => onRecipeSelect(recipe)} />
              ))}
            </View>
          </View>
        )}

        {hasRecipes && favorites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Favorites</Text>
              <Pressable onPress={() => onNavigate("myRecipes")} style={styles.sectionActionButton}>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {favorites.slice(0, 3).map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onPress={() => onRecipeSelect(recipe)} />
              ))}
            </View>
          </View>
        )}

        {hasRecipes && recentRecipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              <Pressable onPress={() => onNavigate("myRecipes")} style={styles.sectionActionButton}>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {recentRecipes.slice(0, 3).map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onPress={() => onRecipeSelect(recipe)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.gray900,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  section: {
    paddingVertical: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.gray900,
  },
  sectionActionButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  sectionAction: {
    ...typography.body,
    fontWeight: "600",
    color: colors.purple600,
  },
  tagGridSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.lg,
    columnGap: spacing.lg,
  },
  tagGridCompact: {
    justifyContent: "flex-start",
  },
  tagChip: {
    alignItems: "center",
    gap: spacing.sm,
  },
  tagChipPressed: {
    opacity: 0.7,
  },
  tagIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  tagLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.gray700,
    textAlign: "center",
  },
  importReadyCard: {
    borderRadius: radius.xl,
    overflow: "hidden",
    alignSelf: "center",
    width: "90%",
    maxWidth: 360,
    ...shadow.md,
  },
  importReadyGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
  },
  importReadyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  importReadyBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  importReadyBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.purple600,
  },
  importReadyContent: {
    flex: 1,
  },
  importReadyTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.white,
  },
  importReadySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
  },
  collectionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  collectionCard: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  collectionThumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.sm,
  },
  collectionThumb: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: radius.md,
  },
  collectionThumbPlaceholder: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  collectionName: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  list: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  recipeCard: {
    flexDirection: "row",
    gap: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.gray100,
    minHeight: 88,
  },
  recipeThumb: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  recipeBody: {
    flex: 1,
    justifyContent: "center",
  },
  recipeTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  recipeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recipeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recipeMetaText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.gray500,
  },
});

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  const duration = formatDuration(recipe.duration);
  return (
    <Pressable style={[styles.recipeCard, shadow.md]} onPress={onPress}>
      <View style={styles.recipeThumb}>
        <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} />
      </View>
      <View style={styles.recipeBody}>
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={styles.recipeMetaRow}>
          {duration && (
            <View style={styles.recipeMetaItem}>
              <Ionicons name="time-outline" size={16} color={colors.gray400} />
              <Text style={styles.recipeMetaText}>{duration}</Text>
            </View>
          )}
          {recipe.isFavorite && <Ionicons name="heart" size={16} color={colors.purple600} />}
        </View>
      </View>
    </Pressable>
  );
};
