import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Ingredient, Recipe, RecipeCollection } from "../data/types";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";
import { RecipeThumbnail } from "./RecipeThumbnail";
import { RecipeAssistantChat } from "./RecipeAssistantChat";
import { AddToCollectionModal } from "./AddToCollectionModal";
import { useApp } from "../data/AppContext";
import {
  getAiLimitMessage,
  getAiLimitTitle,
  getTranslationLimitMessage,
  getOptimizationLimitMessage,
  isAiLimitReached,
  isTranslationLimitReached,
  isOptimizationLimitReached,
} from "../data/usageLimits";

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  onStartCooking: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onAddToShoppingList?: (ingredients: Ingredient[], recipeName: string, recipeId: string) => void;
  onApproveImport?: () => void;
  onOptimizeWithAI?: () => void;
  onTranslateWithAI?: () => void;
  isNewImport?: boolean;
  aiDisabled?: boolean;
  onUpdateViewSettings?: (payload: { servings: number; unitSystem: "metric" | "us" }) => void;
  onDelete?: () => void;
  collections?: RecipeCollection[];
  onAddToCollection?: (recipeId: string, collectionId: string) => void;
  onCreateCollection?: (name: string, recipeId?: string) => void;
}

export const RecipeDetailNew: React.FC<RecipeDetailProps> = ({
  recipe,
  onBack,
  onStartCooking,
  onToggleFavorite,
  onEdit,
  onAddToShoppingList,
  onApproveImport,
  onOptimizeWithAI,
  onTranslateWithAI,
  isNewImport = false,
  aiDisabled = false,
  onUpdateViewSettings,
  onDelete,
  collections = [],
  onAddToCollection,
  onCreateCollection,
}) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [assistantOpen, setAssistantOpen] = useState(false);
  const {
    plan,
    usageSummary,
    addonTranslations,
    addonOptimizations,
    addonAiMessages,
    trialActive,
    trialTranslationsRemaining,
    trialOptimizationsRemaining,
    trialAiMessagesRemaining,
    navigateTo,
    userLanguage,
  } = useApp();
  const translationLimitReached = isTranslationLimitReached(
    plan,
    usageSummary,
    trialActive,
    addonTranslations,
    trialTranslationsRemaining
  );
  const optimizationLimitReached = isOptimizationLimitReached(
    plan,
    usageSummary,
    trialActive,
    addonOptimizations,
    trialOptimizationsRemaining
  );
  const aiLimitReached = isAiLimitReached(
    plan,
    usageSummary,
    trialActive,
    addonAiMessages,
    trialAiMessagesRemaining
  );
  const isPremium = plan === "premium";
  const translateBlocked = aiDisabled || translationLimitReached;
  const optimizeBlocked = aiDisabled || optimizationLimitReached;
  const aiLimitMessage = aiDisabled
    ? "AI features are disabled on your plan. Upgrade to re-enable ChefGPT."
    : getAiLimitMessage(plan);
  const showPremiumBadge = false;
  const showCreditsBadge = false;
  const aiLimitTitle = getAiLimitTitle(plan);
  const aiChatBlocked = aiDisabled || aiLimitReached;
  const openPlans = () => {
    if (typeof navigateTo === "function") {
      navigateTo("planBilling", { focus: "credits" });
    }
  };

  const showAiLimitAlert = () => {
    Alert.alert(aiLimitTitle, aiLimitMessage, [
      { text: "Buy more", onPress: openPlans },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const showTranslateLimitAlert = () => {
    Alert.alert("Translations used up", getTranslationLimitMessage(plan), [
      { text: "Buy more", onPress: openPlans },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const showOptimizeLimitAlert = () => {
    Alert.alert("Optimizations used up", getOptimizationLimitMessage(plan), [
      { text: "Buy more", onPress: openPlans },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const [currentServings, setCurrentServings] = useState((recipe.servingsOverride ?? recipe.servings) || 1);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoUnavailable, setIsVideoUnavailable] = useState(false);
  const [listAdded, setListAdded] = useState(false);
  const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false);
  const videoRef = useRef<Video>(null);
  const detectDefaultUnit = () => {
    const text = recipe.ingredients.map((ingredient) => ingredient.amount ?? "").join(" ").toLowerCase();
    return /(g|kg|ml|l|°c)\b/.test(text) ? "metric" : "us";
  };
  const [unitSystem, setUnitSystem] = useState<"metric" | "us">(recipe.unitSystem ?? detectDefaultUnit());

  const detectRecipeLanguage = (value: Recipe): "en" | "de" => {
    const aggregate = [
      value.title,
      value.description,
      value.notes,
      value.ingredients.map((ingredient) => `${ingredient.name ?? ""}`).join(" "),
      value.steps.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let germanScore = 0;
    let englishScore = 0;
    if (/[äöüß]/i.test(aggregate)) {
      germanScore += 2;
    }
    const germanIndicators = [
      /\bund\b/,
      /\bmit\b/,
      /\bzutaten\b/,
      /\bofen\b/,
      /\bpfanne\b/,
      /\bminuten\b/,
      /\bgramm\b/,
      /\bel\b/,
      /\btl\b/,
      /\bdie\b/,
      /\bder\b/,
      /\bdas\b/,
    ];
    const englishIndicators = [
      /\band\b/,
      /\bwith\b/,
      /\bfor\b/,
      /\bthe\b/,
      /\bto\b/,
      /\bingredients?\b/,
      /\bpreheat\b/,
      /\boven\b/,
      /\bpan\b/,
      /\btsp\b/,
      /\btbsp\b/,
      /\bcups?\b/,
      /\bminutes?\b/,
      /\bserve\b/,
      /\bmix\b/,
      /\bbake\b/,
      /\bsalt\b/,
      /\bpepper\b/,
    ];
    germanIndicators.forEach((pattern) => {
      if (pattern.test(aggregate)) germanScore += 1;
    });
    englishIndicators.forEach((pattern) => {
      if (pattern.test(aggregate)) englishScore += 1;
    });
    return germanScore > englishScore ? "de" : "en";
  };

  const formatSourceLabel = (source?: string) => {
    if (!source) return null;
    if (source === "voice") return null;
    if (source === "photo") return "Scan";
    if (source === "youtube") return "YouTube";
    return source.charAt(0).toUpperCase() + source.slice(1);
  };

  useEffect(() => {
    setIsVideoMuted(false);
    setIsVideoPlaying(false);
    setIsVideoUnavailable(false);
    setListAdded(false);
    setCurrentServings((recipe.servingsOverride ?? recipe.servings) || 1);
    setUnitSystem(recipe.unitSystem ?? detectDefaultUnit());
  }, [recipe.id, recipe.videoUrl, recipe.servingsOverride, recipe.servings, recipe.unitSystem]);

  const parseQuantity = (value: string): number | null => {
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.includes("-")) return null;
    const fractionMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const whole = Number(fractionMatch[1]);
      const numerator = Number(fractionMatch[2]);
      const denominator = Number(fractionMatch[3]);
      if (denominator) {
        return whole + numerator / denominator;
      }
    }
    const simpleFraction = normalized.match(/^(\d+)\/(\d+)$/);
    if (simpleFraction) {
      const numerator = Number(simpleFraction[1]);
      const denominator = Number(simpleFraction[2]);
      if (denominator) {
        return numerator / denominator;
      }
    }
    const numeric = Number(normalized.replace(",", "."));
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    return null;
  };

  const parseAmountParts = (amount: string) => {
    const match = amount.trim().match(
      /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?$/i
    );
    if (!match) return null;
    const quantity = parseQuantity(match[1]);
    if (quantity === null) return null;
    const unitRaw = (match[2] || "").toLowerCase();
    return { quantity, unitRaw };
  };

  const normalizeUnit = (unitRaw: string): string | null => {
    const map: Record<string, string> = {
      g: "g",
      gram: "g",
      grams: "g",
      kg: "kg",
      kilogram: "kg",
      kilograms: "kg",
      ml: "ml",
      milliliter: "ml",
      milliliters: "ml",
      l: "l",
      liter: "l",
      litre: "l",
      liters: "l",
      litres: "l",
      oz: "oz",
      ounce: "oz",
      ounces: "oz",
      lb: "lb",
      lbs: "lb",
      pound: "lb",
      pounds: "lb",
      cup: "cup",
      cups: "cup",
      tbsp: "tbsp",
      tablespoon: "tbsp",
      tablespoons: "tbsp",
      tsp: "tsp",
      teaspoon: "tsp",
      teaspoons: "tsp",
      "fl oz": "fl oz",
    };
    return map[unitRaw] || null;
  };

  const formatQuantity = (value: number) => {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  const scaleAmount = (amount: string, targetServings: number, baseServings: number) => {
    const trimmed = amount.trim();
    if (!trimmed) return amount;
    if (/nach geschmack|n\.\s?g\.?/i.test(trimmed)) {
      return trimmed;
    }
    if (!baseServings || baseServings <= 0) return amount;
    const parts = parseAmountParts(trimmed);
    if (!parts) return amount;
    const scaled = (parts.quantity * targetServings) / baseServings;
    const unitSuffix = parts.unitRaw ? ` ${parts.unitRaw}` : "";
    return `${formatQuantity(scaled)}${unitSuffix}`;
  };

  const convertAmount = (amount: string, target: "metric" | "us") => {
    const trimmed = amount.trim();
    if (!trimmed) return amount;
    if (/nach geschmack|n\.\s?g\.?/i.test(trimmed)) {
      return trimmed;
    }
    const parts = parseAmountParts(trimmed);
    if (!parts) return amount;
    const unit = normalizeUnit(parts.unitRaw || "");
    if (!unit) return amount;

    if (target === "metric") {
      if (["g", "kg", "ml", "l"].includes(unit)) {
        return amount;
      }
      if (unit === "oz") {
        const grams = parts.quantity * 28.3495;
        const value = grams >= 1000 ? grams / 1000 : grams;
        const nextUnit = grams >= 1000 ? "kg" : "g";
        return `${formatQuantity(value)} ${nextUnit}`;
      }
      if (unit === "lb") {
        const grams = parts.quantity * 453.592;
        const value = grams >= 1000 ? grams / 1000 : grams;
        const nextUnit = grams >= 1000 ? "kg" : "g";
        return `${formatQuantity(value)} ${nextUnit}`;
      }
      if (unit === "cup") {
        const ml = parts.quantity * 240;
        const value = ml >= 1000 ? ml / 1000 : ml;
        const nextUnit = ml >= 1000 ? "l" : "ml";
        return `${formatQuantity(value)} ${nextUnit}`;
      }
      if (unit === "tbsp") {
        const ml = parts.quantity * 15;
        return `${formatQuantity(ml)} ml`;
      }
      if (unit === "tsp") {
        const ml = parts.quantity * 5;
        return `${formatQuantity(ml)} ml`;
      }
      if (unit === "fl oz") {
        const ml = parts.quantity * 29.5735;
        const value = ml >= 1000 ? ml / 1000 : ml;
        const nextUnit = ml >= 1000 ? "l" : "ml";
        return `${formatQuantity(value)} ${nextUnit}`;
      }
    }

    if (target === "us") {
      if (["oz", "lb", "cup", "tbsp", "tsp", "fl oz"].includes(unit)) {
        return amount;
      }
      if (unit === "g") {
        const oz = parts.quantity / 28.3495;
        return `${formatQuantity(oz)} oz`;
      }
      if (unit === "kg") {
        const lb = parts.quantity / 0.453592;
        return `${formatQuantity(lb)} lb`;
      }
      if (unit === "ml") {
        if (parts.quantity >= 240) {
          const cups = parts.quantity / 240;
          return `${formatQuantity(cups)} cup`;
        }
        const floz = parts.quantity / 29.5735;
        return `${formatQuantity(floz)} fl oz`;
      }
      if (unit === "l") {
        const ml = parts.quantity * 1000;
        const cups = ml / 240;
        return `${formatQuantity(cups)} cup`;
      }
    }

    return amount;
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const hasNutrition = Boolean(
    recipe.nutrition?.calories ||
      recipe.nutrition?.protein ||
      recipe.nutrition?.carbs ||
      recipe.nutrition?.fat
  );

  const tags = recipe.tags?.filter((tag) => tag.trim().length > 0) ?? [];

  const showImportNotice = Boolean(recipe.isImported) && !recipe.isImportApproved;
  const showImportReview = Boolean(isNewImport) || showImportNotice;
  const canManageCollections = Boolean(onAddToCollection && onCreateCollection);

  const hasIngredients = recipe.ingredients.length > 0;
  const hasSteps = recipe.steps.length > 0;
  const hasTitle = Boolean(recipe.title?.trim());
  const hasDescription = Boolean(recipe.description?.trim());
  const hasServings = Boolean(recipe.servings && recipe.servings > 0);
  const hasCookingTime = Boolean(recipe.totalTime || recipe.cookTime || recipe.prepTime);

  const isIncomplete = !hasTitle || !hasIngredients;
  const looksGood =
    hasTitle &&
    hasDescription &&
    hasIngredients &&
    hasSteps &&
    hasServings &&
    hasCookingTime &&
    hasNutrition;
  const nutritionMissingOnly =
    hasTitle &&
    hasDescription &&
    hasIngredients &&
    hasSteps &&
    hasServings &&
    hasCookingTime &&
    !hasNutrition;
  const cookingTimeMissingOnly =
    hasTitle &&
    hasDescription &&
    hasIngredients &&
    hasSteps &&
    hasServings &&
    !hasCookingTime;
  const servingsMissingOnly =
    hasTitle &&
    hasDescription &&
    hasIngredients &&
    hasSteps &&
    hasCookingTime &&
    hasNutrition &&
    !hasServings;
  const hasMissingDetails = !isIncomplete && !looksGood;
  const preferredLanguage = userLanguage?.toLowerCase().startsWith("de") ? "de" : "en";
  const recipeLanguage = detectRecipeLanguage(recipe);
  const showTranslateAction = recipeLanguage !== preferredLanguage;

  const importReviewCopy = isIncomplete
    ? {
        title: "Recipe incomplete",
        body: (
          <Text style={styles.importReviewText}>
            This source didn’t include enough information to create a usable recipe. Please add the missing
            pieces manually or try another link.{" "}
            <Text style={styles.importReviewEmphasis}>0 recipe import credit used.</Text>
          </Text>
        ),
      }
    : nutritionMissingOnly
      ? {
          title: "Recipe looks good",
          body: "Recipe looks good, but nutrition values are missing. Please add them manually or use AI. 1 recipe import credit used.",
        }
      : cookingTimeMissingOnly
      ? {
          title: "Recipe looks good",
          body: "Cooking time is missing. Please add it manually or use AI. 1 recipe import credit used.",
        }
      : servingsMissingOnly
      ? {
          title: "Recipe looks good",
          body: "Servings are not specified. Please add them manually. 1 recipe import credit used.",
        }
      : looksGood
      ? {
          title: "Recipe looks good",
          body: "All the key details are here. You can approve it now, or tweak anything you’d like. 1 recipe import credit used.",
        }
      : {
          title: "A few details are missing",
          body:
            "Some information is missing. You can add what’s missing manually or use AI to fill the gaps. 1 recipe import credit used.",
        };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.hero}>
          <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroActions}>
            <Pressable style={styles.iconButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={20} color={colors.gray900} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable style={styles.iconButton} onPress={onEdit}>
                <Ionicons name="pencil" size={18} color={colors.gray900} />
              </Pressable>
              {canManageCollections && (
                <Pressable
                  style={styles.iconButton}
                  onPress={() => setIsAddToCollectionOpen(true)}
                >
                  <Ionicons name="folder-outline" size={18} color={colors.gray900} />
                </Pressable>
              )}
              <Pressable style={styles.iconButton} onPress={onToggleFavorite}>
                <Ionicons
                  name={recipe.isFavorite ? "heart" : "heart-outline"}
                  size={18}
                  color={recipe.isFavorite ? colors.gray900 : colors.gray600}
                />
              </Pressable>
              <Pressable
                style={[styles.iconButton, styles.iconButtonDanger]}
                onPress={() => {
                  Alert.alert(
                    "Delete recipe?",
                    "This will permanently remove the recipe.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: onDelete },
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        <View style={styles.heroText}>
            {formatSourceLabel(recipe.source) && (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceText}>{formatSourceLabel(recipe.source)}</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>{recipe.title}</Text>
            {recipe.addedDate && (
              <Text style={styles.heroMeta}>Added {recipe.addedDate.toLocaleDateString()}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          {recipe.sourceUrl && (
            <Pressable
              style={styles.sourceLink}
              onPress={() => Linking.openURL(recipe.sourceUrl!)}
            >
              <Ionicons name="open-outline" size={18} color={colors.gray700} />
              <Text style={styles.sourceLinkText}>
                View original on {formatSourceLabel(recipe.source) || "source"}
              </Text>
            </Pressable>
          )}
          {showImportReview && (
            <View style={[styles.importReviewCard, shadow.md]}>
              <View style={styles.importReviewHeader}>
                <View style={styles.importReviewIcon}>
                  <Ionicons name="checkmark" size={18} color={colors.green600} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.importReviewTitle}>{importReviewCopy.title}</Text>
                  {typeof importReviewCopy.body === "string" ? (
                    <Text style={styles.importReviewText}>{importReviewCopy.body}</Text>
                  ) : (
                    importReviewCopy.body
                  )}
                </View>
              </View>
              <View style={styles.importReviewActions}>
                <Pressable style={styles.importApproveButton} onPress={() => onApproveImport?.()}>
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                  <Text style={styles.importApproveText}>Approve Recipe</Text>
                </Pressable>
                <View style={styles.importActionRow}>
                  <Pressable style={styles.importEditButton} onPress={onEdit}>
                    <Ionicons name="create-outline" size={16} color={colors.gray900} />
                    <Text style={styles.importEditText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.importOptimizeButton,
                      optimizeBlocked && styles.importOptimizeButtonDisabled,
                    ]}
                    onPress={() => {
                      if (optimizeBlocked) {
                        showOptimizeLimitAlert();
                        return;
                      }
                      onOptimizeWithAI?.();
                    }}
                  >
                    <LinearGradient
                      colors={optimizeBlocked ? [colors.gray200, colors.gray200] : ["#a855f7", "#9333ea"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.importOptimizeButtonInner,
                        optimizeBlocked && styles.importOptimizeButtonInnerDisabled,
                      ]}
                    >
                      <Ionicons
                        name="sparkles"
                        size={16}
                        color={optimizeBlocked ? colors.gray500 : colors.white}
                      />
                      <Text
                        style={[
                          styles.importOptimizeText,
                          optimizeBlocked && styles.importOptimizeTextDisabled,
                        ]}
                      >
                        Optimize
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                {isIncomplete ? (
                  <Pressable
                    style={styles.importDeleteButton}
                    onPress={() => {
                      Alert.alert(
                        "Delete recipe?",
                        "This will permanently remove the recipe.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: onDelete },
                        ]
                      );
                    }}
                  >
                    <View style={styles.importDeleteButtonInner}>
                      <Ionicons name="trash-outline" size={16} color={colors.white} />
                      <Text style={styles.importDeleteText}>Delete recipe</Text>
                    </View>
                  </Pressable>
                ) : (
                  showTranslateAction && (
                    <Pressable
                      style={[
                        styles.importTranslateButton,
                        translateBlocked && styles.importTranslateButtonDisabled,
                      ]}
                      onPress={() => {
                        if (translateBlocked) {
                          showTranslateLimitAlert();
                          return;
                        }
                        onTranslateWithAI?.();
                      }}
                    >
                      <LinearGradient
                        colors={translateBlocked ? [colors.gray200, colors.gray200] : ["#3b82f6", "#2563eb"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.importTranslateButtonInner,
                          translateBlocked && styles.importTranslateButtonInnerDisabled,
                        ]}
                      >
                        <Ionicons
                          name="language-outline"
                          size={16}
                          color={translateBlocked ? colors.gray500 : colors.white}
                        />
                        <Text
                          style={[
                            styles.importTranslateText,
                            translateBlocked && styles.importTranslateTextDisabled,
                          ]}
                        >
                          Translate to {preferredLanguage === "en" ? "English" : "German"}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  )
                )}
                <Text style={styles.importReviewFootnote}>• Using AI features costs 1 credit each •</Text>
              </View>
            </View>
          )}
          {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.gray600} />
              <Text style={styles.metaText}>{recipe.totalTime || "—"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color={colors.gray600} />
              <Text style={styles.metaText}>
                {recipe.servings ? `${recipe.servings} servings` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {!isIncomplete && hasServings && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="people-outline" size={16} color={colors.gray700} />
              <Text style={styles.cardTitle}>Adjust Servings</Text>
              <View style={styles.servingsControls}>
                <Pressable
                  style={[styles.servingsButton, currentServings <= 1 && styles.servingsButtonDisabled]}
                  onPress={() => {
                    const next = Math.max(1, currentServings - 1);
                    setCurrentServings(next);
                    onUpdateViewSettings?.({ servings: next, unitSystem });
                  }}
                  disabled={currentServings <= 1}
                >
                  <Ionicons name="remove" size={16} color={colors.gray700} />
                </Pressable>
                <Text style={styles.servingsCount}>{currentServings}</Text>
                <Pressable
                  style={styles.servingsButton}
                  onPress={() => {
                    const next = currentServings + 1;
                    setCurrentServings(next);
                    onUpdateViewSettings?.({ servings: next, unitSystem });
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.gray700} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Ingredients</Text>
          </View>
          {hasIngredients && (
            <View style={styles.unitRow}>
              <View style={styles.unitToggle}>
                {(["metric", "us"] as const).map((unit) => (
                  <Pressable
                    key={unit}
                    style={[styles.unitChip, unitSystem === unit && styles.unitChipActive]}
                    onPress={() => {
                      setUnitSystem(unit);
                      onUpdateViewSettings?.({ servings: currentServings, unitSystem: unit });
                    }}
                  >
                    <Text style={[styles.unitChipText, unitSystem === unit && styles.unitChipTextActive]}>
                      {unit === "metric" ? "Metric" : "US"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {onAddToShoppingList && (
                <Pressable
                  style={[styles.addToListButton, listAdded && styles.addToListButtonActive]}
                  onPress={() => {
                    const selectedIngredients = recipe.ingredients.filter((_, index) =>
                      checkedIngredients.has(index)
                    );
                    if (selectedIngredients.length === 0) {
                      Alert.alert(
                        "Select ingredients",
                        "Choose the ingredients you want to add to your shopping list."
                      );
                      return;
                    }
                    const convertedIngredients = selectedIngredients.map((ingredient) => {
                      const amount = ingredient.amount
                        ? convertAmount(
                            scaleAmount(ingredient.amount, currentServings, recipe.servings || 1),
                            unitSystem
                          ).trim()
                        : "";
                      return {
                        ...ingredient,
                        amount,
                      };
                    });
                    onAddToShoppingList(convertedIngredients, recipe.title, recipe.id);
                    setListAdded(true);
                    setTimeout(() => setListAdded(false), 1600);
                  }}
                >
                  <Ionicons name={listAdded ? "checkmark" : "cart-outline"} size={14} color={colors.white} />
                  <Text style={styles.addToListText}>{listAdded ? "Added" : "Add to List"}</Text>
                </Pressable>
              )}
            </View>
          )}
          {recipe.ingredients.map((ingredient, index) => (
            <Pressable key={`${ingredient.name}-${index}`} style={styles.ingredientRow} onPress={() => toggleIngredient(index)}>
              <View style={[styles.checkbox, checkedIngredients.has(index) && styles.checkboxChecked]}>
                {checkedIngredients.has(index) && <Ionicons name="checkmark" size={12} color={colors.white} />}
              </View>
              <Text style={[styles.ingredientText, checkedIngredients.has(index) && styles.ingredientTextChecked]}>
                {(() => {
                  const amount = convertAmount(
                    scaleAmount(ingredient.amount, currentServings, recipe.servings || 1),
                    unitSystem
                  ).trim();
                  const name = ingredient.name?.trim() || "";
                  const isChecked = checkedIngredients.has(index);
                  return (
                    <>
                      {amount ? (
                        <Text style={[styles.ingredientAmountText, isChecked && styles.ingredientAmountTextChecked]}>
                          {amount}{" "}
                        </Text>
                      ) : null}
                      <Text style={[styles.ingredientNameText, isChecked && styles.ingredientNameTextChecked]}>
                        {name}
                      </Text>
                    </>
                  );
                })()}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Instructions</Text>
          {recipe.videoUrl && (
            <View style={styles.videoWrap}>
              <Pressable
                style={styles.videoPressable}
                onPress={async () => {
                  if (!videoRef.current) return;
                  if (isVideoUnavailable) return;
                  if (isVideoPlaying) {
                    await videoRef.current.pauseAsync();
                    setIsVideoPlaying(false);
                  } else {
                    await videoRef.current.playAsync();
                    setIsVideoPlaying(true);
                  }
                }}
              >
                <Video
                  ref={videoRef}
                  style={styles.video}
                  source={{ uri: recipe.videoUrl }}
                  resizeMode={ResizeMode.COVER}
                  isMuted={isVideoMuted}
                  shouldPlay={isVideoPlaying}
                  isLooping
                  onError={() => {
                    setIsVideoUnavailable(true);
                    setIsVideoPlaying(false);
                  }}
                />
                {!isVideoPlaying && !isVideoUnavailable && (
                  <View style={styles.videoPlayOverlay}>
                    <View style={styles.videoPlayButton}>
                      <Ionicons name="play" size={22} color={colors.white} />
                    </View>
                  </View>
                )}
                {isVideoUnavailable && (
                  <View style={styles.videoUnavailableOverlay}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.white} />
                    <Text style={styles.videoUnavailableText}>Video unavailable</Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.videoControls}>
                <Pressable
                  style={styles.videoButton}
                  onPress={() => {
                    if (isVideoUnavailable) return;
                    setIsVideoMuted((prev) => !prev);
                  }}
                >
                  <Ionicons
                    name={isVideoMuted ? "volume-mute" : "volume-high"}
                    size={18}
                    color={colors.gray900}
                  />
                </Pressable>
              </View>
            </View>
          )}
          {recipe.steps.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          {recipe.source === "youtube" && recipe.sourceUrl && (
            <Pressable
              style={styles.youtubeLinkButton}
              onPress={() => Linking.openURL(recipe.sourceUrl!)}
            >
              <Ionicons name="logo-youtube" size={18} color={colors.gray700} />
              <Text style={styles.youtubeLinkText}>Watch on YouTube</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.gray700} />
            <Text style={styles.cardTitle}>Notes</Text>
          </View>
          <Pressable style={styles.noteButton}>
            <Ionicons name="add" size={16} color={colors.gray600} />
            <Text style={styles.noteButtonText}>Add Note</Text>
          </Pressable>
        </View>

        {hasNutrition && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nutrition per serving</Text>
            <View style={styles.nutritionRow}>
              {recipe.nutrition?.calories && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.calories}</Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
              )}
              {recipe.nutrition?.protein && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.protein}</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
              )}
              {recipe.nutrition?.carbs && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.carbs}</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
              )}
              {recipe.nutrition?.fat && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.fat}</Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {tags.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pricetags-outline" size={16} color={colors.gray700} />
              <Text style={styles.cardTitle}>Tags</Text>
            </View>
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.ctaWrap}>
          <Pressable style={[styles.primaryButton, shadow.md]} onPress={onStartCooking}>
            <Ionicons name="restaurant-outline" size={18} color={colors.white} />
            <Text style={styles.primaryButtonText}>Start Cooking</Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {canManageCollections && (
        <AddToCollectionModal
          isOpen={isAddToCollectionOpen}
          onClose={() => setIsAddToCollectionOpen(false)}
          recipe={recipe}
          collections={collections}
          onAddToCollection={onAddToCollection!}
          onCreateCollection={onCreateCollection!}
        />
      )}

      {!isIncomplete && (
        <>
          <RecipeAssistantChat
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            recipe={recipe}
          />

          <View style={styles.floatingAssistantWrap}>
            <Pressable
              style={[styles.floatingAssistant, shadow.lg, aiChatBlocked && styles.floatingAssistantDisabled]}
              onPress={() => {
                if (aiChatBlocked) {
                  showAiLimitAlert();
                  return;
                }
                setAssistantOpen(true);
              }}
            >
              <Ionicons name="sparkles" size={22} color={aiChatBlocked ? colors.gray500 : colors.white} />
            </Pressable>
          </View>
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  hero: {
    height: 320,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroActions: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDanger: {
    backgroundColor: colors.red500,
  },
  heroText: {
    position: "absolute",
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  sourceText: {
    ...typography.captionBold,
    color: colors.white,
    textTransform: "capitalize",
  },
  heroTitle: {
    ...typography.h1,
    color: colors.white,
  },
  heroMeta: {
    ...typography.caption,
    color: "rgba(255,255,255,0.75)",
    marginTop: spacing.xs,
  },
  heroSubtitle: {
    ...typography.bodySmall,
    color: "rgba(255,255,255,0.85)",
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  description: {
    ...typography.bodySmall,
    color: colors.gray700,
    marginBottom: spacing.lg,
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
  },
  sourceLinkText: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "500",
  },
  importReviewCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  importReviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  importReviewIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  importReviewTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  importReviewText: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginTop: spacing.xs,
  },
  importReviewEmphasis: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.gray900,
  },
  importReviewActions: {
    gap: spacing.sm,
  },
  importApproveButton: {
    borderRadius: radius.xl,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    minHeight: 52,
    flexDirection: "row",
    gap: spacing.sm,
  },
  importApproveText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  importActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  importEditButton: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    minHeight: 52,
    flexDirection: "row",
    gap: spacing.sm,
  },
  importEditText: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  importOptimizeButton: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  importOptimizeButtonDisabled: {
    opacity: 0.85,
  },
  importOptimizeButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  importOptimizeButtonInnerDisabled: {
    backgroundColor: colors.gray200,
  },
  importOptimizeText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  importOptimizeTextDisabled: {
    color: colors.gray500,
  },
  importTranslateButton: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  importTranslateButtonDisabled: {
    opacity: 0.85,
  },
  importTranslateButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  importTranslateButtonInnerDisabled: {
    backgroundColor: colors.gray200,
  },
  importTranslateText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  importTranslateTextDisabled: {
    color: colors.gray500,
  },
  importReviewFootnote: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray400,
    marginTop: spacing.xs,
  },
  importDeleteButton: {
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.red500,
  },
  importDeleteButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  importDeleteText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  importBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    ...shadow.md,
  },
  importBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  card: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
    flex: 1,
  },
  servingsControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsButtonDisabled: {
    opacity: 0.4,
  },
  servingsCount: {
    ...typography.bodyBold,
    color: colors.gray900,
    minWidth: 24,
    textAlign: "center",
  },
  addToListButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    marginLeft: "auto",
  },
  addToListButtonActive: {
    backgroundColor: colors.green500,
  },
  addToListText: {
    ...typography.caption,
    color: colors.white,
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  unitToggle: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 3,
  },
  unitChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  unitChipActive: {
    backgroundColor: colors.white,
  },
  unitChipText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  unitChipTextActive: {
    color: colors.gray900,
    fontWeight: "600",
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.gray900,
    borderColor: colors.gray900,
  },
  ingredientText: {
    ...typography.body,
    color: colors.gray900,
  },
  ingredientTextChecked: {
    color: colors.gray500,
    textDecorationLine: "line-through",
  },
  ingredientAmountText: {
    fontWeight: "700",
    color: colors.gray700,
  },
  ingredientAmountTextChecked: {
    color: colors.gray500,
  },
  ingredientNameText: {
    color: colors.gray900,
  },
  ingredientNameTextChecked: {
    color: colors.gray500,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.lg,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
  stepText: {
    ...typography.body,
    color: colors.gray700,
    flex: 1,
  },
  youtubeLinkButton: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.gray300,
    borderWidth: 1,
    borderColor: colors.gray200,
    minHeight: 48,
    ...shadow.md,
  },
  youtubeLinkText: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "600",
  },
  videoWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.gray100,
  },
  videoPressable: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: colors.gray100,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  videoUnavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(15,23,42,0.75)",
  },
  videoUnavailableText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  videoPlayButton: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoControls: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  videoButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.gray200,
    paddingVertical: spacing.lg,
    backgroundColor: colors.gray50,
  },
  noteButtonText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionValue: {
    ...typography.h2,
    color: colors.gray900,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.gray700,
  },
  ctaWrap: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.black,
    borderRadius: radius.full,
    minHeight: 60,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  floatingAssistantWrap: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    zIndex: 30,
  },
  floatingAssistant: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingAssistantDisabled: {
    backgroundColor: colors.gray400,
  },
  limitBanner: {
    position: "absolute",
    bottom: 96,
    left: spacing.xl,
    right: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.purple100,
    backgroundColor: colors.purple100,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  limitBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  premiumBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
