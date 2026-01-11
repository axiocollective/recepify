import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Ingredient, Recipe } from "../data/types";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";
import { askRecipeAssistant, trackUsageEvent } from "../services/assistantApi";
import { fetchUsageSummary } from "../services/supabaseData";
import { POPULAR_RECIPE_TAG_COUNT, RECIPE_TAGS } from "../../../../packages/shared/constants/recipe-tags";
import { useApp } from "../data/AppContext";
import {
  getOptimizationLimitMessage,
  getTranslationLimitMessage,
  isOptimizationLimitReached,
  isTranslationLimitReached,
} from "../data/usageLimits";

interface RecipeEditProps {
  recipe: Recipe;
  onBack: () => void;
  onSave: (updatedRecipe: Recipe) => void;
  onApproveImport?: (updatedRecipe: Recipe) => void;
  isNewRecipe?: boolean;
  aiDisabled?: boolean;
  initialAiAction?: "optimize" | "translate" | null;
  onAiActionHandled?: () => void;
  onAiActionComplete?: (payload: {
    type: "optimize" | "translate";
    creditsUsed: number | null;
    recipe: Recipe;
  }) => void;
  suppressAiAlerts?: boolean;
}

const popularTags = RECIPE_TAGS.slice(0, POPULAR_RECIPE_TAG_COUNT);

export const RecipeEdit: React.FC<RecipeEditProps> = ({
  recipe,
  onBack,
  onSave,
  onApproveImport,
  isNewRecipe = false,
  aiDisabled = false,
  initialAiAction = null,
  onAiActionHandled,
  onAiActionComplete,
  suppressAiAlerts = false,
}) => {
  const normalizeTimeValue = (value?: string | null) => {
    if (!value) return "";
    const match = String(value).match(/\d+/);
    return match ? match[0] : "";
  };
  const normalizeRecipeTimes = (value: Recipe): Recipe => ({
    ...value,
    prepTime: normalizeTimeValue(value.prepTime),
    cookTime: normalizeTimeValue(value.cookTime),
    totalTime: normalizeTimeValue(value.totalTime),
  });
  const [formData, setFormData] = useState<Recipe>(() => normalizeRecipeTimes(recipe));
  const [showAllTags, setShowAllTags] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [isOptimizingIngredients, setIsOptimizingIngredients] = useState(false);
  const [isEstimatingTotalTime, setIsEstimatingTotalTime] = useState(false);
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerDetail, setDisclaimerDetail] = useState<string | null>(null);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const formDataRef = useRef(formData);
  const {
    plan,
    usageSummary,
    addonOptimizations,
    addonTranslations,
    refreshUsageSummary,
    consumeAction,
    trialActive,
    trialOptimizationsRemaining,
    trialTranslationsRemaining,
    navigateTo,
    userLanguage,
  } = useApp();
  const optimizationLimitReached = isOptimizationLimitReached(
    plan,
    usageSummary,
    trialActive,
    addonOptimizations,
    trialOptimizationsRemaining
  );
  const translationLimitReached = isTranslationLimitReached(
    plan,
    usageSummary,
    trialActive,
    addonTranslations,
    trialTranslationsRemaining
  );
  const isPremium = plan === "premium";
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disclaimerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressCreditAlertsRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveAnimReverse = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatAnimDelayed = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinAnimReverse = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const dotAnimDelayed = useRef(new Animated.Value(0)).current;
  const dotAnimDelayedMore = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const disclaimerAnim = useRef(new Animated.Value(0)).current;
  const tagInputRef = useRef<TextInput>(null);
  const didAutoRun = useRef(false);
  const titleValue = formData.title?.trim();
  const descriptionValue = formData.description?.trim();
  const hasAiIngredients = formData.ingredients?.some(
    (ingredient) => ingredient.name?.trim() || ingredient.amount?.trim()
  );
  const hasAiInputs = Boolean(titleValue && descriptionValue && hasAiIngredients);
  const aiInputMissing = !hasAiInputs;
  const hideAi = isNewRecipe && !recipe.isImported && recipe.id.startsWith("recipe-");

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    const waveReverseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnimReverse, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(waveAnimReverse, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    const floatDelayedLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnimDelayed, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(floatAnimDelayed, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    );
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    );
    const spinReverseLoop = Animated.loop(
      Animated.timing(spinAnimReverse, { toValue: 1, duration: 10000, useNativeDriver: true })
    );
    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    const dotLoopDelayed = Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(dotAnimDelayed, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnimDelayed, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    const dotLoopDelayedMore = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(dotAnimDelayedMore, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnimDelayedMore, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );

    pulseLoop.start();
    waveLoop.start();
    waveReverseLoop.start();
    floatLoop.start();
    floatDelayedLoop.start();
    spinLoop.start();
    spinReverseLoop.start();
    dotLoop.start();
    dotLoopDelayed.start();
    dotLoopDelayedMore.start();

    return () => {
      pulseLoop.stop();
      waveLoop.stop();
      waveReverseLoop.stop();
      floatLoop.stop();
      floatDelayedLoop.stop();
      spinLoop.stop();
      spinReverseLoop.stop();
      dotLoop.stop();
      dotLoopDelayed.stop();
      dotLoopDelayedMore.stop();
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (disclaimerTimeoutRef.current) clearTimeout(disclaimerTimeoutRef.current);
    };
  }, [
    dotAnim,
    dotAnimDelayed,
    dotAnimDelayedMore,
    floatAnim,
    floatAnimDelayed,
    pulseAnim,
    spinAnim,
    spinAnimReverse,
    waveAnim,
    waveAnimReverse,
  ]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  useEffect(() => {
    setFormData(normalizeRecipeTimes(recipe));
  }, [recipe.id]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: isOptimizing || isTranslating ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [contentAnim, isOptimizing, isTranslating]);

  useEffect(() => {
    if (!showDisclaimer) return;
    disclaimerAnim.setValue(0);
    Animated.timing(disclaimerAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [disclaimerAnim, showDisclaimer]);

  const stripCodeFences = (text: string): string => {
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    return text.trim();
  };

  const removeTrailingCommas = (jsonLike: string): string =>
    jsonLike.replace(/,\s*(}|\])/g, "$1");

  const extractJsonArray = (raw: string) => {
    const text = stripCodeFences(raw);
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const slice = removeTrailingCommas(text.slice(start, end + 1));
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  };

  const extractJsonObject = (raw: string) => {
    const text = stripCodeFences(raw);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = removeTrailingCommas(text.slice(start, end + 1));
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  };

  const cleanJsonText = (reply: string): string => stripCodeFences(reply);

  const formatActionsUsed = (value: number) => value.toLocaleString("en-US");
  const formatAiCreditUsage = (value: number | null, type: "translate" | "optimize") => {
    if (!value) return "No credits used.";
    const label = type === "translate" ? "translation credit" : "AI optimization credit";
    return `${formatActionsUsed(value)} ${label}${value === 1 ? "" : "s"} used.`;
  };

  const getActionUsedDelta = async (
    beforeCount: number,
    field: "optimizationCount" | "translationCount"
  ) => {
    try {
      const latest = await fetchUsageSummary();
      if (!latest) return null;
      const delta = latest[field] - beforeCount;
      return delta > 0 ? delta : null;
    } catch {
      return null;
    }
  };

  const showActionUsedAlert = async (
    beforeCount: number,
    field: "optimizationCount" | "translationCount"
  ) => {
    if (isOptimizing || isTranslating || suppressAiAlerts || suppressCreditAlertsRef.current) return;
    const delta = await getActionUsedDelta(beforeCount, field);
    if (!delta) return;
    const type = field === "translationCount" ? "translate" : "optimize";
    const title = type === "translate" ? "Recipe translated" : "Recipe updated";
    Alert.alert(title, formatAiCreditUsage(delta, type));
  };

  const showAiResultAlert = (
    type: "translate" | "optimize",
    creditsUsed: number | null,
    detail?: string | null
  ) => {
    const title = type === "translate" ? "Recipe translated" : "Recipe optimized";
    const extra = detail ? `\n\n${detail}` : "";
    Alert.alert(
      title,
      `Please review the changes before saving.\n\n${formatAiCreditUsage(creditsUsed, type)}${extra}`
    );
    setDisclaimerDetail(detail ?? null);
    setShowDisclaimer(false);
  };

  const openPlans = () => {
    if (typeof navigateTo === "function") {
      navigateTo("planBilling", { focus: "credits" });
    }
  };

  const showOptimizeLimitAlert = () => {
    Alert.alert("Optimizations used up", getOptimizationLimitMessage(plan), [
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

  const buildRecipePayload = (value: Recipe) => ({
    title: (value.title ?? "").trim() || "Untitled Recipe",
    description: (value.description ?? "").trim() || undefined,
    servings: value.servings ? String(value.servings) : undefined,
    prep_time: value.prepTime ?? undefined,
    cook_time: value.cookTime ?? undefined,
    total_time: value.totalTime ?? undefined,
    difficulty: value.difficulty ?? undefined,
    meal_type: value.category ?? undefined,
    source: value.source,
    tags: value.tags ?? [],
    notes: value.notes ?? undefined,
    ingredients: value.ingredients
      .map((ingredient) => {
        const parts = [ingredient.amount?.trim(), ingredient.name?.trim()].filter(Boolean);
        return parts.join(" ").trim();
      })
      .filter((line) => line.length > 0),
    steps: value.steps.filter((step) => step.trim().length > 0),
  });

  const isTitleWeak = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return true;
    const lower = normalized.toLowerCase();
    if (lower === "untitled" || lower.includes("recipe") || lower.includes("test")) return true;
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    if (wordCount < 2) return true;
    return normalized.length < 6;
  };

  const isDescriptionWeak = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return true;
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    return normalized.length < 60 || wordCount < 10;
  };

  const areStepsWeak = (steps: string[]) => {
    const usable = steps.map((step) => step.trim()).filter((step) => step.length > 0);
    return usable.length < 2;
  };

  const hasNutritionData = (value: Recipe) => {
    const nutrition = value.nutrition;
    if (!nutrition) return false;
    return Boolean(
      nutrition.calories || nutrition.protein || nutrition.carbs || nutrition.fat
    );
  };

  const parseAmountParts = (amount: string) => {
    const match = amount.match(/^(\d+(?:[\/.,]\d+)?(?:\s+\d+\/\d+)?(?:-\d+(?:[\/.,]\d+)?)?)\s*(.*)$/);
    if (!match) return null;
    const quantity = Number(match[1].replace(",", "."));
    if (!Number.isFinite(quantity)) return null;
    return { quantity, unitRaw: match[2]?.trim() || "" };
  };

  const formatQuantity = (value: number) => {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  const scaleAmount = (amount: string, targetServings: number, baseServings: number) => {
    const trimmed = amount.trim();
    if (!trimmed) return amount;
    if (/nach geschmack|n\.\s?g\.?/i.test(trimmed)) return trimmed;
    if (!baseServings || baseServings <= 0) return amount;
    const parts = parseAmountParts(trimmed);
    if (!parts) return amount;
    const scaled = (parts.quantity * targetServings) / baseServings;
    const unitSuffix = parts.unitRaw ? ` ${parts.unitRaw}` : "";
    return `${formatQuantity(scaled)}${unitSuffix}`;
  };

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

  const getRecipeLanguage = (value: Recipe): "en" | "de" => detectRecipeLanguage(value);

  const runWithMinimumDuration = async (durationMs: number, action: () => Promise<void>) => {
    const start = Date.now();
    await action();
    const elapsed = Date.now() - start;
    if (elapsed < durationMs) {
      await new Promise((resolve) => setTimeout(resolve, durationMs - elapsed));
    }
  };

  const parseStepsFromReply = (reply: string): string[] => {
    const normalizedReply = cleanJsonText(reply);
    const parsed = extractJsonObject(normalizedReply);
    let steps: string[] = [];
    if (parsed && Array.isArray(parsed.steps)) {
      steps = parsed.steps.map((step: unknown) => String(step ?? "").trim()).filter(Boolean);
    } else if (Array.isArray(parsed)) {
      steps = parsed.map((step: unknown) => String(step ?? "").trim()).filter(Boolean);
    }
    if (!steps.length) {
      const arrayMatch = normalizedReply.match(/"steps"\s*:\s*\[([\s\S]*?)\]/i);
      const fallbackSource = arrayMatch ? arrayMatch[1] : normalizedReply;
      steps = fallbackSource
        .split(/\n+/)
        .map((line) => line.trim())
        .map((line) => line.replace(/^[-*\d.)\s`]+/, ""))
        .map((line) => line.replace(/^"|",?$|"$/g, ""))
        .filter((line) => Boolean(line) && !/^(?:\}|\{|\[|\]|"?steps"?|json)$/i.test(line));
    }
    return steps;
  };

  const limitToTwoSentences = (text: string, maxChars = 200): string => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }
    const sentences = normalized
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean);
    if (!sentences || sentences.length === 0) {
      return normalized;
    }
    const combined = sentences.slice(0, 2).join(" ").trim();
    if (combined.length <= maxChars) {
      return combined;
    }
    const safeSlice = combined.slice(0, maxChars + 1);
    const lastSpace = safeSlice.lastIndexOf(" ");
    const candidate = lastSpace > 0 ? safeSlice.slice(0, lastSpace) : combined.slice(0, maxChars);
    return candidate.replace(/[.,;:!?-]+$/, "").trim();
  };

  const parseNumberFromValue = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
      if (match) {
        const parsed = Number.parseFloat(match[0]);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return undefined;
  };

  const formatMacroText = (value: unknown): string | undefined => {
    const parsed = parseNumberFromValue(value);
    if (parsed !== undefined) {
      return `${Math.round(parsed)}g`;
    }
    if (typeof value === "string") {
      return value.trim() || undefined;
    }
    return undefined;
  };

  const extractNutritionFromText = (text: string) => {
    const findNumber = (keywords: string[]) => {
      const pattern = new RegExp(`(?:${keywords.join("|")})[^\\d]*(\\d+(?:[.,]\\d+)?)`, "i");
      const match = text.match(pattern);
      if (match) {
        return Number.parseFloat(match[1].replace(",", "."));
      }
      return undefined;
    };

    const calories = findNumber(["calories", "kcal", "cal"]);
    const protein = findNumber(["protein"]);
    const carbs = findNumber(["carbs", "carbohydrates"]);
    const fat = findNumber(["fat"]);

    if (!calories && !protein && !carbs && !fat) {
      return null;
    }

    const macroText = (value?: number) => (value !== undefined ? `${Math.round(value)}g` : undefined);

    return {
      calories: calories ? Math.max(1, Math.round(calories)) : undefined,
      protein: macroText(protein),
      carbs: macroText(carbs),
      fat: macroText(fat),
    };
  };

  const parseNutritionFromReply = (reply: string) => {
    const normalized = cleanJsonText(reply);
    const parsed = extractJsonObject(normalized);
    if (parsed && typeof parsed === "object") {
      const pick = (...keys: string[]) => {
        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            return (parsed as Record<string, unknown>)[key];
          }
        }
        return undefined;
      };

      const caloriesValue = parseNumberFromValue(pick("calories", "kcal", "energy"));
      const proteinValue = formatMacroText(pick("protein", "protein_g"));
      const carbsValue = formatMacroText(pick("carbs", "carbohydrates", "carbs_g"));
      const fatValue = formatMacroText(pick("fat", "fat_g"));

      if (caloriesValue || proteinValue || carbsValue || fatValue) {
        return {
          calories: caloriesValue ? Math.max(1, Math.round(caloriesValue)) : undefined,
          protein: proteinValue,
          carbs: carbsValue,
          fat: fatValue,
        };
      }
    }

    return extractNutritionFromText(normalized);
  };

  const parseTagsFromReply = (reply: string): string[] => {
    const normalized = cleanJsonText(reply);
    const parsed = extractJsonObject(normalized);
    let raw: unknown[] = [];
    if (parsed) {
      if (Array.isArray((parsed as { tags?: unknown }).tags)) {
        raw = ((parsed as { tags?: unknown }).tags as unknown[]) ?? [];
      } else if (Array.isArray(parsed)) {
        raw = parsed as unknown[];
      }
    }
    if (!raw.length) {
      const match = normalized.match(/\[(.*?)\]/s);
      if (match) {
        raw = match[1]
          .split(",")
          .map((tag) => tag.replace(/["\n\r]/g, "").trim())
          .filter(Boolean);
      }
    }
    return raw.map((tag) => String(tag ?? "").trim()).filter(Boolean);
  };

  const parseIngredientsFromReply = (reply: string) => {
    const normalized = cleanJsonText(reply);
    const parsedArray = extractJsonArray(normalized);
    const parsedObject = extractJsonObject(normalized);
    const raw = Array.isArray(parsedArray)
      ? parsedArray
      : parsedObject && Array.isArray((parsedObject as { ingredients?: unknown }).ingredients)
      ? ((parsedObject as { ingredients?: unknown }).ingredients as unknown[])
      : [];
    return raw
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const name = typeof record.name === "string" ? record.name.trim() : "";
          const amount = typeof record.amount === "string" ? record.amount.trim() : "";
          return name ? { name, amount } : null;
        }
        if (typeof item === "string") {
          const text = item.trim();
          return text ? { name: text, amount: "" } : null;
        }
        return null;
      })
      .filter((item): item is { name: string; amount: string } => Boolean(item));
  };

  const titleText = (formData.title ?? "").trim();
  const descriptionText = (formData.description ?? "").trim();
  const ingredientNames = formData.ingredients
    .map((ingredient) => ingredient.name?.trim() || "")
    .filter((name) => name.length > 0);
  const ingredientSummaries = formData.ingredients
    .map((ingredient) => {
      const parts = [ingredient.amount?.trim(), ingredient.name?.trim()].filter(Boolean);
      return parts.join(" ").trim();
    })
    .filter((line) => line.length > 0);
  const hasIngredients = ingredientNames.length > 0;
  const hasIngredientAmounts =
    formData.ingredients.length > 0 &&
    formData.ingredients.every(
      (ingredient) => Boolean(ingredient.name?.trim()) && Boolean(ingredient.amount?.trim())
    );
  const missingIngredientAmounts = formData.ingredients.filter(
    (ingredient) => ingredient.name?.trim() && !ingredient.amount?.trim()
  );
  const hasSteps = formData.steps.some((step) => step.trim().length > 0);

  const canGenerateDescription = Boolean(titleText) && hasIngredients;
  const canOptimizeIngredients = hasIngredients;
  const canGenerateSteps = descriptionText.length > 0 && hasIngredients;
  const canCalculateNutrition = hasIngredientAmounts;
  const canSuggestTags = descriptionText.length > 0 || hasSteps;
  const canEstimateTotalTime = hasIngredients && hasSteps;
  const recipeLanguage = getRecipeLanguage(formData);
  const preferredLanguage = userLanguage?.toLowerCase().startsWith("de") ? "de" : "en";
  const isInPreferredLanguage = recipeLanguage === preferredLanguage;

  const visibleTags = useMemo(
    () => (showAllTags ? RECIPE_TAGS : RECIPE_TAGS.slice(0, POPULAR_RECIPE_TAG_COUNT)),
    [showAllTags]
  );

  const handleEstimateTotalTime = async () => {
    const snapshot = formDataRef.current;
    const hasIngredientsValue = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
    const hasStepsValue = snapshot.steps.some((step) => step.trim().length > 0);
    if (!hasIngredientsValue || !hasStepsValue || isEstimatingTotalTime) return;
    setIsEstimatingTotalTime(true);
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    try {
      const response = await askRecipeAssistant({
        recipe: buildRecipePayload(snapshot),
        messages: [
          {
            role: "user",
            content:
              `Estimate the total time in minutes based on the ingredients and steps. Respond ONLY in JSON like {"totalTimeMinutes": 25}. Do not include words or units.`,
          },
        ],
        usage_context: "optimized_with_ai",
      });
      const normalized = cleanJsonText(response.reply ?? "");
      const parsed = extractJsonObject(normalized);
      const minutesFromJson = Number((parsed as Record<string, unknown>)?.totalTimeMinutes);
      const directMatch = normalized.match(/(\d{1,4})/);
      const minutes = Number.isFinite(minutesFromJson)
        ? minutesFromJson
        : directMatch
        ? Number(directMatch[1])
        : Number.NaN;
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error("ChefGPT did not return a valid total time.");
      }
      updateField("totalTime", String(Math.round(minutes)));
      refreshUsageSummary();
      await showActionUsedAlert(actionsBefore, "optimizationCount");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to estimate total time right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      setIsEstimatingTotalTime(false);
    }
  };

  const updateField = <K extends keyof Recipe>(field: K, value: Recipe[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const applyTranslatedRecipe = (payload: Partial<Recipe>) => {
    setFormData((prev) => ({
      ...prev,
      title: payload.title ?? prev.title,
      description: payload.description ?? prev.description,
      ingredients: payload.ingredients ?? prev.ingredients,
      steps: payload.steps ?? prev.steps,
    }));
  };

  const handleTranslateRecipe = async (sourceLanguage: "de" | "en", targetLanguage: "de" | "en") => {
    const snapshot = formDataRef.current;
    const response = await askRecipeAssistant({
      recipe: buildRecipePayload(snapshot),
      messages: [
        {
          role: "user",
          content:
            `Translate this entire recipe from ${sourceLanguage === "de" ? "German" : "English"} into ${targetLanguage === "de" ? "German" : "English"}. ` +
            "Return valid JSON with the same structure (title, description, ingredients (amount/name/line), steps). " +
            "Do not add commentary or tags.",
        },
      ],
      usage_context: "translated_with_ai",
    });
    const normalized = cleanJsonText(response.reply ?? "");
    const parsed = extractJsonObject(normalized);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("ChefGPT did not return a valid translation.");
    }
    const translatedIngredients = Array.isArray((parsed as Record<string, unknown>).ingredients)
      ? ((parsed as Record<string, unknown>).ingredients as Array<Record<string, unknown>>).map((ingredient) => ({
          amount: typeof ingredient.amount === "string" ? ingredient.amount : "",
          name: typeof ingredient.name === "string" ? ingredient.name : "",
        }))
      : snapshot.ingredients;
    const translatedSteps = Array.isArray((parsed as Record<string, unknown>).steps)
      ? ((parsed as Record<string, unknown>).steps as unknown[]).map((step) => String(step ?? ""))
      : snapshot.steps;
    applyTranslatedRecipe({
      title: String((parsed as Record<string, unknown>).title ?? snapshot.title ?? ""),
      description: String((parsed as Record<string, unknown>).description ?? snapshot.description ?? ""),
      ingredients: translatedIngredients,
      steps: translatedSteps,
    });
    refreshUsageSummary();
  };

  const handleTranslate = async () => {
    if (isTranslating || isOptimizing) return;
    if (aiDisabled || translationLimitReached) {
      showTranslateLimitAlert();
      return;
    }
    if (isInPreferredLanguage) {
      return;
    }
    try {
      const allowance = await consumeAction({ action: "translation" });
      if (!allowance.allowed) {
        showTranslateLimitAlert();
        return;
      }
    } catch {
      Alert.alert("Unable to translate", "Please try again in a moment.");
      return;
    }
    setIsTranslating(true);
    suppressCreditAlertsRef.current = true;
    const actionsBefore = usageSummary?.translationCount ?? 0;
    try {
      await trackUsageEvent({
        event_type: "translate",
        source: "recipe_edit",
        usage_context: "translated_with_ai",
      });
    } catch {
      // Tracking failure should not block translation.
    }
    try {
      await runWithMinimumDuration(2000, async () => {
        await handleTranslateRecipe(recipeLanguage, preferredLanguage);
      });
      const actionsUsed = await getActionUsedDelta(actionsBefore, "translationCount");
      if (suppressAiAlerts) {
        onAiActionComplete?.({
          type: "translate",
          creditsUsed: actionsUsed,
          recipe: formDataRef.current,
        });
      } else {
        showAiResultAlert("translate", actionsUsed, null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to translate the recipe right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      suppressCreditAlertsRef.current = false;
      setIsTranslating(false);
    }
  };

  const addIngredient = () => {
    updateField("ingredients", [...formData.ingredients, { amount: "", name: "" }]);
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...formData.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    updateField("ingredients", updated);
  };

  const removeIngredient = (index: number) => {
    updateField("ingredients", formData.ingredients.filter((_, i) => i !== index));
  };

  const addStep = () => {
    updateField("steps", [...formData.steps, ""]);
  };

  const updateStep = (index: number, value: string) => {
    const updated = [...formData.steps];
    updated[index] = value;
    updateField("steps", updated);
  };

  const removeStep = (index: number) => {
    updateField("steps", formData.steps.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (!showTagInput) {
      setShowTagInput(true);
      setTimeout(() => tagInputRef.current?.focus(), 0);
      return;
    }
    const trimmed = newTagDraft.trim().toLowerCase();
    if (!trimmed) {
      setShowTagInput(false);
      return;
    }
    const tags = formData.tags || [];
    if (tags.includes(trimmed)) {
      setNewTagDraft("");
      setShowTagInput(false);
      return;
    }
    updateField("tags", [...tags, trimmed]);
    setNewTagDraft("");
    setShowTagInput(false);
  };

  const updateTag = (index: number, value: string) => {
    const updated = [...(formData.tags || [])];
    updated[index] = value.toLowerCase();
    updateField("tags", updated);
  };

  const removeTag = (index: number) => {
    updateField("tags", (formData.tags || []).filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    const tags = formData.tags || [];
    if (tags.includes(tag)) {
      updateField("tags", tags.filter((t) => t !== tag));
    } else {
      updateField("tags", [...tags, tag]);
    }
  };

  const handleGenerateDescription = async () => {
    const snapshot = formDataRef.current;
    const titleValue = (snapshot.title ?? "").trim();
    const hasIngredientsValue = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
    if (!titleValue || !hasIngredientsValue || isGeneratingDescription) return;
    setIsGeneratingDescription(true);
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    const snapshotLanguage = getRecipeLanguage(snapshot);
    const snapshotLanguageLabel = snapshotLanguage === "de" ? "German" : "English";
    try {
      const response = await askRecipeAssistant({
        recipe: buildRecipePayload(snapshot),
        messages: [
          {
            role: "user",
            content:
              `Write at most two crisp sentences (maximum 200 characters total) in ${snapshotLanguageLabel} that capture this recipe's key flavors and cooking style. Keep it punchy, no emojis, no lists—plain text only.`,
          },
        ],
        usage_context: "optimized_with_ai",
      });
      const summary = limitToTwoSentences(response.reply ?? "");
      if (!summary) {
        throw new Error("ChefGPT did not return a usable description.");
      }
      updateField("description", summary);
      refreshUsageSummary();
      await showActionUsedAlert(actionsBefore, "optimizationCount");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate description right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleOptimizeIngredients = async () => {
    const snapshot = formDataRef.current;
    const hasIngredientsValue = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
    if (!hasIngredientsValue || isOptimizingIngredients) return;
    setIsOptimizingIngredients(true);
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    const ingredientList = snapshot.ingredients
      .map((ingredient, index) => {
        const label = ingredient.name?.trim() || `Ingredient ${index + 1}`;
        const amount = ingredient.amount?.trim() || "missing";
        return `${index + 1}. ${label} (${amount})`;
      })
      .join("\n");

    const normalizeGeneratedAmount = (value?: string) => {
      const trimmed = value?.trim();
      if (!trimmed) return "";
      const lower = trimmed.toLowerCase();
      if (lower === "nach") return "nach Geschmack";
      if (["nach geschmack", "nach belieben", "nach bedarf", "zum abschmecken"].includes(lower)) {
        return "nach Geschmack";
      }
      return trimmed;
    };

    try {
      const snapshotLanguage = getRecipeLanguage(snapshot);
      const snapshotLanguageLabel = snapshotLanguage === "de" ? "German" : "English";
      const response = await askRecipeAssistant({
        recipe: buildRecipePayload(snapshot),
        messages: [
          {
            role: "user",
            content:
              `Do NOT change any amounts that are already provided. Only fill in amounts that are marked as "missing" and keep the same number of ingredients and order. Respond ONLY with JSON array like [{"index":1,"name":"tomatoes","amount":"200 g"}] written in ${snapshotLanguageLabel}. If amount is "to taste", use the full phrase (e.g. "nach Geschmack"). Ingredients:\n${ingredientList}`,
          },
        ],
        usage_context: "optimized_with_ai",
      });
      const normalized = cleanJsonText(response.reply ?? "");
      let updates: Array<{ index?: number; amount?: string; name?: string }> = [];
      const parsedObject = extractJsonObject(normalized);
      if (Array.isArray(parsedObject)) {
        updates = parsedObject as Array<{ index?: number; amount?: string; name?: string }>;
      } else {
        try {
          const parsedArray = JSON.parse(normalized);
          if (Array.isArray(parsedArray)) {
            updates = parsedArray as Array<{ index?: number; amount?: string; name?: string }>;
          }
        } catch {
          updates = [];
        }
      }
      if (!updates.length) {
        throw new Error("ChefGPT did not return usable ingredients.");
      }
      updateField(
        "ingredients",
        snapshot.ingredients.map((ingredient, idx) => {
          const match = updates.find((update) => update.index === idx + 1);
          if (!match) {
            return ingredient;
          }
          const amountMissing = !ingredient.amount?.trim();
          return {
            ...ingredient,
            name: ingredient.name?.trim() ? ingredient.name : match.name?.trim() || ingredient.name,
            amount: amountMissing
              ? normalizeGeneratedAmount(match.amount) || ingredient.amount
              : ingredient.amount,
          };
        })
      );
      refreshUsageSummary();
      await showActionUsedAlert(actionsBefore, "optimizationCount");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to optimize ingredients right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      setIsOptimizingIngredients(false);
    }
  };


  const handleImproveSteps = async () => {
    const snapshot = formDataRef.current;
    const descriptionValue = (snapshot.description ?? "").trim();
    const hasIngredientsValue = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
    if (!descriptionValue || !hasIngredientsValue || isGeneratingSteps) return;
    setIsGeneratingSteps(true);
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    const snapshotLanguage = getRecipeLanguage(snapshot);
    const snapshotLanguageLabel = snapshotLanguage === "de" ? "German" : "English";
    try {
      const response = await askRecipeAssistant({
        recipe: buildRecipePayload(snapshot),
        messages: [
          {
            role: "user",
            content:
              `Generate a clear, logically ordered list of cooking steps for this recipe in ${snapshotLanguageLabel}. Each step should be 1–3 sentences, detailed enough to cook without being verbose. Do NOT prefix steps with "Step 1" or numbers. Respond ONLY in JSON with the shape {"steps": ["Sentence...", "Sentence..."]}.`,
          },
        ],
        usage_context: "optimized_with_ai",
      });
      const steps = parseStepsFromReply(response.reply ?? "");
      if (!steps.length) {
        throw new Error("The assistant response did not contain usable steps.");
      }
      updateField("steps", steps);
      refreshUsageSummary();
      await showActionUsedAlert(actionsBefore, "optimizationCount");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate steps right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  const handleCalculateNutrition = async () => {
    const snapshot = formDataRef.current;
    const hasServingsValue = Boolean(snapshot.servings && snapshot.servings > 0);
    const hasAmountsValue =
      snapshot.ingredients.length > 0 &&
      snapshot.ingredients.every(
        (ingredient) => Boolean(ingredient.name?.trim()) && Boolean(ingredient.amount?.trim())
      );
    if (!hasServingsValue) {
      Alert.alert("Add servings first", "Please specify servings before calculating nutrition.");
      return;
    }
    if (!hasAmountsValue || isCalculatingNutrition) return;
    setIsCalculatingNutrition(true);
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    const snapshotLanguage = getRecipeLanguage(snapshot);
    const snapshotLanguageLabel = snapshotLanguage === "de" ? "German" : "English";
    try {
      const response = await askRecipeAssistant({
        recipe: buildRecipePayload(snapshot),
        messages: [
          {
            role: "user",
            content:
              `Estimate the per-serving nutrition for this recipe (calories, protein grams, carbs grams, fat grams) based on the ingredient list and their amounts. Respond ONLY in JSON like {"calories": number, "protein": "10g", "carbs": "25g", "fat": "12g"} using whole numbers, and write any units in ${snapshotLanguageLabel}.`,
          },
        ],
        usage_context: "optimized_with_ai",
      });
      const nutrition = parseNutritionFromReply(response.reply ?? "");
      if (!nutrition) {
        throw new Error("The assistant response did not contain nutrition data.");
      }
      updateField("nutrition", {
        ...formData.nutrition,
        calories: nutrition.calories ?? formData.nutrition?.calories,
        protein: nutrition.protein ?? formData.nutrition?.protein,
        carbs: nutrition.carbs ?? formData.nutrition?.carbs,
        fat: nutrition.fat ?? formData.nutrition?.fat,
      });
      refreshUsageSummary();
      await showActionUsedAlert(actionsBefore, "optimizationCount");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to calculate nutrition right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      setIsCalculatingNutrition(false);
    }
  };

  const handleSuggestTags = async () => {
    const snapshot = formDataRef.current;
    const descriptionValue = (snapshot.description ?? "").trim();
    const hasStepsValue = snapshot.steps.some((step) => step.trim().length > 0);
    if ((!descriptionValue && !hasStepsValue) || isSuggestingTags) return;
    setIsSuggestingTags(true);
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    const allowedTags = RECIPE_TAGS;
    const allowedLower = new Map(allowedTags.map((tag) => [tag.toLowerCase(), tag]));
    try {
      const response = await askRecipeAssistant({
        recipe: buildRecipePayload(snapshot),
        messages: [
          {
            role: "user",
            content:
              `Select the most relevant tags for this recipe using ONLY the following list: ${allowedTags.join(
                ", "
              )}. Respond strictly in JSON like {"tags":["tag1","tag2"]} using the exact casing provided.`,
          },
        ],
        usage_context: "optimized_with_ai",
      });
      const tags = parseTagsFromReply(response.reply ?? "")
        .map((tag) => tag.toLowerCase())
        .map((tag) => allowedLower.get(tag))
        .filter((tag): tag is string => Boolean(tag));
      if (!tags.length) {
        throw new Error("ChefGPT could not determine relevant tags for this recipe.");
      }
      updateField("tags", Array.from(new Set(tags)));
      refreshUsageSummary();
      await showActionUsedAlert(actionsBefore, "optimizationCount");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to suggest tags right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      setIsSuggestingTags(false);
    }
  };

  const handleImproveTitle = async () => {
    const snapshot = formDataRef.current;
    const snapshotLanguage = getRecipeLanguage(snapshot);
    const snapshotLanguageLabel = snapshotLanguage === "de" ? "German" : "English";
    const response = await askRecipeAssistant({
      recipe: buildRecipePayload(snapshot),
      messages: [
        {
          role: "user",
          content:
            `Create a short, clear recipe title in ${snapshotLanguageLabel} using the available ingredients, steps, or description. Return plain text only, no quotes.`,
        },
      ],
      usage_context: "optimized_with_ai",
    });
    const suggestion = (response.reply ?? "").split("\n")[0]?.trim();
    if (!suggestion) {
      throw new Error("ChefGPT did not return a usable title.");
    }
    updateField("title", suggestion);
    refreshUsageSummary();
  };

  const handleInferIngredients = async () => {
    const snapshot = formDataRef.current;
    const snapshotLanguage = getRecipeLanguage(snapshot);
    const snapshotLanguageLabel = snapshotLanguage === "de" ? "German" : "English";
    const response = await askRecipeAssistant({
      recipe: buildRecipePayload(snapshot),
      messages: [
        {
          role: "user",
          content:
            `Infer the ingredient list for this recipe in ${snapshotLanguageLabel} from the description and steps. Respond ONLY with JSON array like [{"name":"ingredient","amount":"200 g"}]. Use empty string for unknown amounts.`,
        },
      ],
      usage_context: "optimized_with_ai",
    });
    const inferred = parseIngredientsFromReply(response.reply ?? "");
    if (!inferred.length) {
      throw new Error("ChefGPT could not infer ingredients.");
    }
    updateField(
      "ingredients",
      inferred.map((item) => ({
        name: item.name,
        amount: item.amount ?? "",
      }))
    );
    refreshUsageSummary();
  };

  const handleOptimize = async () => {
    if (isOptimizing) return;
    if (aiInputMissing) {
      Alert.alert(
        "Add a bit more information",
        "Please add a title, a short description, and at least one ingredient before using AI."
      );
      return;
    }
    if (aiDisabled || optimizationLimitReached) {
      showOptimizeLimitAlert();
      return;
    }
    try {
      const allowance = await consumeAction({ action: "optimization" });
      if (!allowance.allowed) {
        showOptimizeLimitAlert();
        return;
      }
    } catch {
      Alert.alert("AI unavailable", "Please try again in a moment.");
      return;
    }
    setIsOptimizing(true);
    suppressCreditAlertsRef.current = true;
    const actionsBefore = usageSummary?.optimizationCount ?? 0;
    let missingServingsForNutrition = false;
    try {
      await trackUsageEvent({
        event_type: "optimize",
        source: "recipe_edit",
        usage_context: "optimized_with_ai",
      });
    } catch {
      // Tracking failure should not block optimization.
    }
    try {
      const skipped: string[] = [];
      await runWithMinimumDuration(3000, async () => {
        let snapshot = formDataRef.current;
        const titleTextValue = (snapshot.title ?? "").trim();
        const descriptionValue = (snapshot.description ?? "").trim();
        const stepsValue = snapshot.steps.map((step) => step.trim()).filter((step) => step.length > 0);
        const hasIngredientsValue = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());

        if (isTitleWeak(titleTextValue)) {
          if (descriptionValue || stepsValue.length || hasIngredientsValue) {
            await handleImproveTitle();
          } else {
            skipped.push("Title: missing details");
          }
        }

        snapshot = formDataRef.current;
        const hasIngredientsNow = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
        const hasStepsNow = snapshot.steps.some((step) => step.trim().length > 0);
        const descriptionNow = (snapshot.description ?? "").trim();

        if (!hasIngredientsNow) {
          if (descriptionNow || hasStepsNow) {
            try {
              await handleInferIngredients();
            } catch {
              skipped.push("Ingredients: not enough info");
            }
          } else {
            skipped.push("Ingredients: missing description or steps");
          }
        }

        snapshot = formDataRef.current;
        const ingredientNeedsWork = snapshot.ingredients.some(
          (ingredient) => ingredient.name?.trim() && !ingredient.amount?.trim()
        );
        if (snapshot.ingredients.length > 0 && ingredientNeedsWork) {
          await handleOptimizeIngredients();
        }

        snapshot = formDataRef.current;
        const updatedTitle = (snapshot.title ?? "").trim();
        const updatedDescription = (snapshot.description ?? "").trim();
        const updatedHasIngredients = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());

        if (isDescriptionWeak(updatedDescription)) {
          if (updatedTitle && updatedHasIngredients) {
            await handleGenerateDescription();
          } else {
            skipped.push("Description: needs title + ingredients");
          }
        }

        snapshot = formDataRef.current;
        const updatedDescriptionForSteps = (snapshot.description ?? "").trim();
        const updatedHasIngredientsForSteps = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
        if (areStepsWeak(snapshot.steps)) {
          if (updatedDescriptionForSteps && updatedHasIngredientsForSteps) {
            await handleImproveSteps();
          } else {
            skipped.push("Steps: needs description + ingredients");
          }
        }

        snapshot = formDataRef.current;
        const hasIngredientAmountsNow =
          snapshot.ingredients.length > 0 &&
          snapshot.ingredients.every(
            (ingredient) => Boolean(ingredient.name?.trim()) && Boolean(ingredient.amount?.trim())
          );
        if (!hasNutritionData(snapshot)) {
          if (hasIngredientAmountsNow) {
            if (snapshot.servings && snapshot.servings > 0) {
              await handleCalculateNutrition();
            } else {
              missingServingsForNutrition = true;
            }
          } else {
            skipped.push("Nutrition: needs ingredient amounts");
          }
        }

        snapshot = formDataRef.current;
        const tagsNow = (snapshot.tags || []).map((tag) => tag.trim()).filter(Boolean);
        if (tagsNow.length === 0) {
          const hasDescriptionForTags = (snapshot.description ?? "").trim().length > 0;
          const hasStepsForTags = snapshot.steps.some((step) => step.trim().length > 0);
          if (hasDescriptionForTags || hasStepsForTags) {
            await handleSuggestTags();
          } else {
            skipped.push("Tags: needs description or steps");
          }
        }

        snapshot = formDataRef.current;
        const hasTotalTime = (snapshot.totalTime ?? "").trim().length > 0;
        const hasIngredientsForTime = snapshot.ingredients.some((ingredient) => ingredient.name?.trim());
        const hasStepsForTime = snapshot.steps.some((step) => step.trim().length > 0);
        if (!hasTotalTime) {
          if (hasIngredientsForTime && hasStepsForTime) {
            await handleEstimateTotalTime();
          } else {
            skipped.push("Total time: needs ingredients + steps");
          }
        }
      });
      const detailLines: string[] = [];
      if (missingServingsForNutrition) {
        detailLines.push(
          "Nutrition values weren’t calculated because serving size is missing. Please add servings and try again."
        );
      }
      if (skipped.length) {
        detailLines.push(
          "We did our best, but the source info was a bit thin. Feel free to add the missing parts manually."
        );
      }
      const skipDetail = detailLines.length ? detailLines.join(" ") : null;
      const actionsUsed = await getActionUsedDelta(actionsBefore, "optimizationCount");
      if (suppressAiAlerts) {
        onAiActionComplete?.({
          type: "optimize",
          creditsUsed: actionsUsed ?? 0,
          recipe: formDataRef.current,
        });
      } else {
        showAiResultAlert("optimize", actionsUsed, skipDetail);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to optimize the recipe right now.";
      Alert.alert("AI unavailable", message);
    } finally {
      suppressCreditAlertsRef.current = false;
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    if (!initialAiAction || didAutoRun.current || hideAi) return;
    didAutoRun.current = true;
    if (initialAiAction === "translate") {
      void handleTranslate();
    } else {
      void handleOptimize();
    }
    onAiActionHandled?.();
  }, [handleOptimize, handleTranslate, initialAiAction, onAiActionHandled]);

  const handleApproveImport = () => {
    const updated = { ...formData, isImported: true, isImportApproved: true };
    setFormData(updated);
    onApproveImport?.(updated);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access to add a recipe image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      updateField("thumbnail", result.assets[0].uri);
    }
  };

  const processingActive = isOptimizing || isTranslating;
  const optimizeDisabled = isOptimizing || isTranslating || aiDisabled || optimizationLimitReached;
  const translateDisabled =
    isOptimizing || isTranslating || aiDisabled || translationLimitReached || isInPreferredLanguage;
  const contentScale = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.98],
  });
  const contentOpacity = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <Animated.View style={[styles.container, { opacity: contentOpacity, transform: [{ scale: contentScale }] }]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable onPress={onBack} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={20} color={colors.gray900} />
              </Pressable>
              <Text style={styles.headerTitle}>Edit Recipe</Text>
              <View style={styles.headerActionsInline}>
                <Pressable
                  style={[styles.saveButton, shadow.md]}
                  onPress={() => {
                    const shouldApprove = formData.isImported && !formData.isImportApproved;
                    const next = shouldApprove ? { ...formData, isImportApproved: true } : formData;
                    setFormData(next);
                    onSave(next);
                  }}
                >
                  <Ionicons name="save-outline" size={16} color={colors.white} />
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
          {!hideAi && (
            <View style={styles.aiTopRow}>
              <Pressable
                onPress={handleTranslate}
                disabled={translateDisabled}
                style={({ pressed }) => [
                  styles.aiTopButton,
                  pressed && !translateDisabled && styles.aiTopButtonPressed,
                ]}
              >
                <LinearGradient
                  colors={translateDisabled ? [colors.gray200, colors.gray200] : ["#3b82f6", "#2563eb"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiTopGradient}
                >
                  <Ionicons
                    name="language-outline"
                    size={18}
                    color={translateDisabled ? colors.gray500 : colors.white}
                  />
                  <Text style={[styles.aiTopText, translateDisabled && styles.aiTopTextDisabled]}>
                    Translate
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={handleOptimize}
                disabled={optimizeDisabled}
                style={({ pressed }) => [
                  styles.aiTopButton,
                  pressed && !optimizeDisabled && styles.aiTopButtonPressed,
                ]}
              >
                <LinearGradient
                  colors={optimizeDisabled ? [colors.gray200, colors.gray200] : ["#a855f7", "#9333ea"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiTopGradient}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={18}
                    color={optimizeDisabled ? colors.gray500 : colors.white}
                  />
                  <Text style={[styles.aiTopText, optimizeDisabled && styles.aiTopTextDisabled]}>
                    Optimize
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Recipe Title</Text>
              <TextInput
                value={formData.title}
                onChangeText={(value) => updateField("title", value)}
                placeholder="Enter recipe title"
                placeholderTextColor={colors.gray500}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Description</Text>
              </View>
              <TextInput
                value={formData.description || ""}
                onChangeText={(value) => updateField("description", value)}
                placeholder="Brief description of the recipe"
                placeholderTextColor={colors.gray500}
                style={[styles.input, styles.textarea]}
                multiline
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipe Image</Text>
            {formData.thumbnail ? (
              <View style={{ gap: spacing.md }}>
                <View style={styles.imagePreview}>
                  <Image source={{ uri: formData.thumbnail }} style={styles.image} />
                </View>
                <View style={styles.imageActions}>
                  <Pressable style={styles.secondaryButton} onPress={handlePickImage}>
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.gray700} />
                    <Text style={styles.secondaryButtonText}>Change Image</Text>
                  </Pressable>
                  <Pressable style={styles.removeButton} onPress={() => updateField("thumbnail", undefined)}>
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.imageEmpty} onPress={handlePickImage}>
                <View style={styles.imageIcon}>
                  <Ionicons name="camera-outline" size={28} color={colors.gray500} />
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.imageTitle}>Add Recipe Image</Text>
                  <Text style={styles.imageSubtitle}>Tap to upload</Text>
                </View>
              </Pressable>
            )}
          </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Time & Servings</Text>
        </View>
        <View style={styles.grid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Total Time</Text>
            <View style={styles.inputWithUnit}>
              <TextInput
                value={formData.totalTime || ""}
                onChangeText={(value) => updateField("totalTime", value.replace(/[^\d]/g, ""))}
                placeholder="0"
                placeholderTextColor={colors.gray500}
                style={[styles.input, styles.inputWithUnitField]}
                keyboardType="number-pad"
              />
              <Text style={styles.unitLabel}>min</Text>
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Servings</Text>
            <TextInput
              value={formData.servings ? String(formData.servings) : ""}
              onChangeText={(value) => updateField("servings", Number(value) || 1)}
              placeholder="4"
              placeholderTextColor={colors.gray500}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <Pressable style={styles.addButton} onPress={addIngredient}>
            <Ionicons name="add" size={16} color={colors.gray700} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        <View style={{ gap: spacing.md }}>
          {formData.ingredients.map((ingredient, index) => (
            <View key={`${ingredient.name}-${index}`} style={styles.ingredientRow}>
              <TextInput
                value={ingredient.amount}
                onChangeText={(value) => updateIngredient(index, "amount", value)}
                placeholder="Amount"
                placeholderTextColor={colors.gray500}
                style={[
                  styles.input,
                  styles.amountInput,
                  ingredient.amount?.trim().length && ingredient.amount.trim().length > 10
                    ? styles.amountSmallText
                    : null,
                ]}
              />
              <TextInput
                value={ingredient.name}
                onChangeText={(value) => updateIngredient(index, "name", value)}
                placeholder="Ingredient name"
                placeholderTextColor={colors.gray500}
                style={[styles.input, styles.flexInput]}
              />
              <Pressable onPress={() => removeIngredient(index)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={16} color={colors.gray400} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Pressable style={styles.addButton} onPress={addStep}>
            <Ionicons name="add" size={16} color={colors.gray700} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        <View style={{ gap: spacing.md }}>
          {formData.steps.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <TextInput
                value={step}
                onChangeText={(value) => updateStep(index, value)}
                placeholder="Describe this step"
                placeholderTextColor={colors.gray500}
                style={[styles.input, styles.stepInput]}
                multiline
              />
              <Pressable onPress={() => removeStep(index)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={16} color={colors.gray400} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
        </View>
        <View style={styles.grid}>
          <View style={styles.field}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={formData.nutrition?.calories ? String(formData.nutrition.calories) : ""}
              onChangeText={(value) =>
                updateField("nutrition", { ...formData.nutrition, calories: Number(value) || undefined })
              }
              placeholder="420"
              placeholderTextColor={colors.gray500}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Protein</Text>
            <TextInput
              value={formData.nutrition?.protein || ""}
              onChangeText={(value) =>
                updateField("nutrition", { ...formData.nutrition, protein: value })
              }
              placeholder="12g"
              placeholderTextColor={colors.gray500}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Carbs</Text>
            <TextInput
              value={formData.nutrition?.carbs || ""}
              onChangeText={(value) =>
                updateField("nutrition", { ...formData.nutrition, carbs: value })
              }
              placeholder="65g"
              placeholderTextColor={colors.gray500}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fat</Text>
            <TextInput
              value={formData.nutrition?.fat || ""}
              onChangeText={(value) =>
                updateField("nutrition", { ...formData.nutrition, fat: value })
              }
              placeholder="14g"
              placeholderTextColor={colors.gray500}
              style={styles.input}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <Pressable style={styles.addButton} onPress={addTag}>
            <Ionicons name="add" size={16} color={colors.gray700} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        {showTagInput && (
          <View style={styles.tagInputRow}>
            <TextInput
              ref={tagInputRef}
              value={newTagDraft}
              onChangeText={setNewTagDraft}
              placeholder="Add a tag"
              placeholderTextColor={colors.gray500}
              autoCapitalize="none"
              style={styles.tagInputField}
              returnKeyType="done"
              onSubmitEditing={addTag}
              onBlur={() => {
                if (!newTagDraft.trim()) {
                  setShowTagInput(false);
                }
              }}
            />
          </View>
        )}
        {(formData.tags || []).length > 0 && (
          <>
            <Text style={styles.label}>Selected tags</Text>
            <View style={styles.tagsRow}>
              {(formData.tags || []).map((tag, index) => (
                <View key={`${tag}-${index}`} style={styles.tagChip}>
                  <TextInput
                    value={tag}
                    onChangeText={(value) => updateTag(index, value)}
                    placeholder="New tag"
                    placeholderTextColor={colors.gray500}
                    autoCapitalize="none"
                    style={styles.tagInput}
                  />
                  <Pressable onPress={() => removeTag(index)} style={styles.tagRemove}>
                    <Ionicons name="close" size={14} color={colors.gray500} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>All tags</Text>
          <View style={styles.suggestionsRow}>
            {visibleTags.map((tag) => {
              const selected = (formData.tags || []).includes(tag);
              return (
                <Pressable
                  key={tag}
                  style={[styles.suggestionChip, selected && styles.suggestionChipActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.suggestionText, selected && styles.suggestionTextActive]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
          {RECIPE_TAGS.length > POPULAR_RECIPE_TAG_COUNT && (
            <Pressable onPress={() => setShowAllTags((prev) => !prev)}>
              <Text style={styles.showMoreText}>
                {showAllTags ? "Show fewer tags" : "Show all tags"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chef's Notes</Text>
        <TextInput
          value={formData.notes || ""}
          onChangeText={(value) => updateField("notes", value)}
          placeholder="Any additional tips or notes about this recipe"
          placeholderTextColor={colors.gray500}
          style={[styles.input, styles.textarea]}
          multiline
        />
      </View>
        </ScrollView>
      </Animated.View>

      {processingActive && (
        <View style={styles.processingOverlay} pointerEvents="none">
          <View style={styles.processingCardWrap}>
            <View style={styles.processingCard}>
              <View style={styles.processingIconWrap}>
                <View style={styles.processingIconCore}>
                  <Ionicons name="sparkles" size={36} color={colors.white} />
                </View>
                <Animated.View
                  style={[
                    styles.processingPing,
                    {
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.1],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.4],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.processingPing,
                    styles.processingPingAlt,
                    {
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 0.05],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.1, 1.6],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              <View style={styles.processingText}>
                <Text style={styles.processingTitle}>
                  {isTranslating ? "ChefGPT is translating..." : "ChefGPT does its magic"}
                </Text>
                <Text style={styles.processingSubtitle}>
                  {isTranslating ? "Translating your recipe to English" : "Analyzing and optimizing your recipe"}
                </Text>
                <View style={styles.processingDots}>
                  <Animated.View
                    style={[
                      styles.processingDot,
                      {
                        transform: [
                          {
                            translateY: dotAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -6],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.processingDot,
                      {
                        transform: [
                          {
                            translateY: dotAnimDelayed.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -6],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.processingDot,
                      {
                        transform: [
                          {
                            translateY: dotAnimDelayedMore.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -6],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {showDisclaimer && !hideAi && (
        <Animated.View
          style={[
            styles.disclaimerWrap,
            {
              opacity: disclaimerAnim,
              transform: [
                {
                  translateY: disclaimerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={[styles.disclaimerCard, shadow.md]}>
            <View style={styles.disclaimerIcon}>
              <Ionicons name="information-circle-outline" size={16} color={colors.gray700} />
            </View>
            <View style={styles.disclaimerContent}>
              <Text style={styles.disclaimerTitle}>Please Review Changes</Text>
              <Text style={styles.disclaimerText}>
                AI suggestions may not be perfect. Please double-check and adjust the content as needed.
              </Text>
              {disclaimerDetail && (
                <Text style={styles.disclaimerDetailText}>{disclaimerDetail}</Text>
              )}
            </View>
            <Pressable
              onPress={() => setShowDisclaimer(false)}
              style={styles.disclaimerClose}
            >
              <Ionicons name="close" size={16} color={colors.gray600} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    zIndex: 2,
  },
  limitNotice: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
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
  limitNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
  },
  headerActionsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginLeft: "auto",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.gray900,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    minHeight: 44,
  },
  saveText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.white,
  },
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.gray900,
  },
  aiTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  aiTopButton: {
    flex: 1,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  aiTopButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  aiTopGradient: {
    minHeight: 44,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  aiTopText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.white,
  },
  aiTopTextDisabled: {
    color: colors.gray500,
  },
  headerTooltip: {
    position: "absolute",
    top: -52,
    right: 0,
    zIndex: 20,
    backgroundColor: colors.gray900,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 200,
    ...shadow.md,
  },
  headerTooltipText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.white,
  },
  sectionActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  field: {
    gap: spacing.md,
  },
  fieldHalf: {
    width: "48%",
    gap: spacing.md,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    lineHeight: 22,
    minHeight: 44,
    backgroundColor: colors.white,
  },
  inputWithUnit: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  inputWithUnitField: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 44,
    backgroundColor: "transparent",
    fontSize: 17,
    lineHeight: 22,
  },
  unitLabel: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
    paddingLeft: spacing.sm,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  imagePreview: {
    borderRadius: radius.lg,
    overflow: "hidden",
    aspectRatio: 16 / 9,
    backgroundColor: colors.gray100,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    minHeight: 44,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray700,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "#fee2e2",
    minHeight: 44,
  },
  removeText: {
    fontSize: 15,
    lineHeight: 20,
    color: "#dc2626",
  },
  imageEmpty: {
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  imageIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  imageTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "500",
    color: colors.gray900,
  },
  imageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  amountInput: {
    width: 128,
  },
  amountSmallText: {
    fontSize: 12,
    lineHeight: 16,
  },
  flexInput: {
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    minHeight: 44,
  },
  addButtonText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray700,
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
    marginTop: spacing.sm,
  },
  stepBadgeText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
    fontWeight: "500",
  },
  stepInput: {
    flex: 1,
    minHeight: 88,
    borderRadius: radius.md,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  tagInputRow: {
    marginBottom: spacing.md,
  },
  tagInputField: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray900,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tagText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray900,
  },
  tagInput: {
    minWidth: 60,
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray900,
    paddingVertical: 0,
  },
  tagRemove: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  suggestionChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    minHeight: 44,
    justifyContent: "center",
  },
  suggestionChipActive: {
    backgroundColor: colors.gray900,
  },
  suggestionText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray900,
    textTransform: "capitalize",
  },
  suggestionTextActive: {
    color: colors.white,
  },
  showMoreText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    textDecorationLine: "underline",
    marginTop: spacing.sm,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  processingGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  waveLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  waveLayerSecondary: {
    opacity: 0.3,
  },
  waveGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle: {
    position: "absolute",
  },
  sparkleOne: {
    top: "25%",
    left: "25%",
  },
  sparkleTwo: {
    top: "33%",
    right: "25%",
  },
  sparkleThree: {
    bottom: "33%",
    left: "33%",
  },
  sparkleFour: {
    top: "66%",
    right: "33%",
  },
  sparkleFive: {
    top: "50%",
    left: "20%",
  },
  sparkleSix: {
    bottom: "25%",
    right: "20%",
  },
  sparklePurple: {
    opacity: 0.7,
  },
  sparklePurpleLight: {
    opacity: 0.6,
  },
  sparklePink: {
    opacity: 0.5,
  },
  sparklePurpleDark: {
    opacity: 0.6,
  },
  sparklePinkLight: {
    opacity: 0.5,
  },
  processingCardWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  processingCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 24,
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderWidth: 2,
    borderColor: "rgba(216, 180, 254, 0.6)",
    alignItems: "center",
    gap: 16,
    maxWidth: 448,
    width: "100%",
    ...shadow.lg,
  },
  processingIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  processingIconCore: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.purple600,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  processingPing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(168, 85, 247, 0.4)",
  },
  processingPingAlt: {
    backgroundColor: "rgba(236, 72, 153, 0.3)",
  },
  processingText: {
    alignItems: "center",
    gap: 8,
  },
  processingTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: colors.gray900,
    textAlign: "center",
  },
  processingSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray600,
    textAlign: "center",
  },
  processingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
  },
  processingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purple500,
  },
  disclaimerWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 96,
    zIndex: 50,
  },
  disclaimerCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  disclaimerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  disclaimerContent: {
    flex: 1,
    gap: 4,
  },
  disclaimerTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
  },
  disclaimerDetailText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray600,
  },
  disclaimerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
});
