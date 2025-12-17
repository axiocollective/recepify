'use client';

import NextImage from "next/image";
import { ArrowLeft, Save, Plus, X, Trash2, Upload, Camera, Sparkles, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Recipe, RecipeIngredient } from "@/types/figma";
import { askRecipeAssistant } from "@/lib/api";
import type { RecipeAssistantRecipePayload } from "@/types/assistant";
import { POPULAR_RECIPE_TAG_COUNT, RECIPE_TAGS } from "@/constants/recipe-tags";

const normalizeTagKey = (tag?: string | null) =>
  (tag ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const sanitizeTags = (tags?: string[]) =>
  (tags ?? [])
    .map((tag) => (tag ?? "").trim().toLowerCase())
    .filter((tag) => Boolean(tag) && !tag.startsWith("#"));

type AiStatus = { type: "success" | "error"; message: string } | null;
type SupportedLanguage = "en" | "de";

const detectRecipeLanguage = (value: Recipe): SupportedLanguage => {
  const aggregate = [
    value.title,
    value.description,
    value.notes,
    value.ingredients.map((ingredient) => `${ingredient.name ?? ""} ${ingredient.line ?? ""}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/[äöüß]/i.test(aggregate)) {
    return "de";
  }
  const germanIndicators = [
    /\bund\b/,
    /\bmit\b/,
    /\bzutaten\b/,
    /\bgarnieren\b/,
    /\bofen\b/,
    /\bpfanne\b/,
    /\bel\b/,
    /\btl\b/,
    /\bgramm\b/,
  ];
  if (germanIndicators.some((pattern) => pattern.test(aggregate))) {
    return "de";
  }
  return "en";
};

const stripCodeFences = (text: string): string => {
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeMatch) {
    return codeMatch[1].trim();
  }
  return text.trim();
};

const removeTrailingCommas = (jsonLike: string): string =>
  jsonLike.replace(/,\s*(}|\])/g, "$1");

const describeIngredient = (ingredient: RecipeIngredient): string => {
  const parts = [
    ingredient.amount?.trim(),
    (ingredient.name ?? ingredient.line)?.trim(),
  ].filter(Boolean);
  return parts.join(" ").trim();
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
      .filter((line) =>
        Boolean(line) &&
        !/^(?:\}|\{|\[|\]|"?steps"?|json)$/i.test(line)
      );
  }
  return steps;
};

const limitToTwoSentences = (text: string, maxChars = 200): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  const sentences = normalized.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean);
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

const extractUnitLabelFromAmount = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/[\p{L}]+(?:[\p{L}\s\/-]*)?$/u);
  if (!match) {
    return null;
  }
  return match[0].trim().toLowerCase();
};

const UNDER_30_MINUTES_TAG = "under 30 minutes";

const parseMinutesFromTimeText = (value?: string | null): number | undefined => {
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

const normalizeIngredientLabel = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalized || null;
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
  const protein = findNumber(["protein", "eiweiß", "eiweis"]);
  const carbs = findNumber(["carbs", "carbohydrates", "kohlenhydrate"]);
  const fat = findNumber(["fat", "fett"]);

  if (!calories && !protein && !carbs && !fat) {
    return null;
  }

  const macroText = (value?: number) =>
    value !== undefined ? `${Math.round(value)}g` : undefined;

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

interface RecipeEditProps {
  recipe: Recipe;
  onBack: () => void;
  onSave: (updatedRecipe: Recipe) => void;
}

export function RecipeEdit({ recipe, onBack, onSave }: RecipeEditProps) {
  const [formData, setFormData] = useState<Recipe>(() => ({
    ...recipe,
    tags: sanitizeTags(recipe.tags),
  }));
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [stepsStatus, setStepsStatus] = useState<AiStatus>(null);
  const [nutritionStatus, setNutritionStatus] = useState<AiStatus>(null);
  const [descriptionStatus, setDescriptionStatus] = useState<AiStatus>(null);
  const [tagStatus, setTagStatus] = useState<AiStatus>(null);
  const [isTranslatingRecipe, setIsTranslatingRecipe] = useState(false);
  const [translationStatus, setTranslationStatus] = useState<AiStatus>(null);
  const [isAddingIngredientUnits, setIsAddingIngredientUnits] = useState(false);
  const [ingredientUnitsStatus, setIngredientUnitsStatus] = useState<AiStatus>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const ensureUnderThirtyMinutesTag = useCallback((minutes?: number) => {
    setFormData((prev) => {
      const existingTags = prev.tags ?? [];
      const hasUnderThirtyTag = existingTags.some(
        (tag) => (tag ?? "").trim().toLowerCase() === UNDER_30_MINUTES_TAG
      );
      const shouldHaveTag = typeof minutes === "number" && minutes > 0 && minutes <= 30;
      if (shouldHaveTag && !hasUnderThirtyTag) {
        return { ...prev, tags: [...existingTags, UNDER_30_MINUTES_TAG] };
      }
      if (!shouldHaveTag && hasUnderThirtyTag) {
        return {
          ...prev,
          tags: existingTags.filter(
            (tag) => (tag ?? "").trim().toLowerCase() !== UNDER_30_MINUTES_TAG
          ),
        };
      }
      return prev;
    });
  }, []);
  useEffect(() => {
    const minutes = parseMinutesFromTimeText(formData.totalTime);
    ensureUnderThirtyMinutesTag(minutes);
  }, [formData.totalTime, formData.tags, ensureUnderThirtyMinutesTag]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showVideo = formData.source === "tiktok" && Boolean(formData.videoUrl);
  const createEmptyIngredient = (): RecipeIngredient => ({
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ing-${Math.random().toString(36).slice(2, 9)}`,
    amount: "",
    name: "",
    line: "",
  });
  const handleSave = () => {
    onSave({ ...formData, tags: sanitizeTags(formData.tags) });
  };

  const updateField = <K extends keyof Recipe>(field: K, value: Recipe[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }) as Recipe);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField("thumbnail", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    updateField("thumbnail", undefined);
  };

  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, createEmptyIngredient()],
    }));
  };

  const updateIngredientField = (index: number, field: "amount" | "name", value: string) => {
    setFormData((prev) => {
      const nextIngredients = prev.ingredients.map((ingredient, idx) => {
        if (idx !== index) {
          return ingredient;
        }
        const updated = { ...ingredient, [field]: value };
        const combined = [updated.amount, updated.name].filter(Boolean).join(" ").trim();
        return { ...updated, line: combined || updated.line || "" };
      });
      return { ...prev, ingredients: nextIngredients };
    });
  };

  const removeIngredient = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const applyTranslatedRecipe = (payload: Recipe) => {
    setFormData((prev) => ({
      ...prev,
      title: payload.title,
      description: payload.description,
      notes: payload.notes,
      ingredients: payload.ingredients,
      steps: payload.steps,
      tags: sanitizeTags(payload.tags),
    }));
  };

  const currentRecipeLanguage = useMemo(() => detectRecipeLanguage(formData), [formData]);
  const needsEnglishTranslation = currentRecipeLanguage !== "en";
  const translationButtonLabel = isTranslatingRecipe ? "Translating..." : "Translate";
  const translationButtonClasses = (() => {
    if (isTranslatingRecipe) {
      return "bg-gradient-to-br from-purple-400 to-purple-500 text-white opacity-80 cursor-wait";
    }
    return needsEnglishTranslation
      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
      : "bg-gray-100 text-gray-400 cursor-not-allowed";
  })();
  const recipeLanguageLabel = currentRecipeLanguage === "de" ? "German" : "English";

  const handleTranslateRecipe = async () => {
    if (isTranslatingRecipe || !needsEnglishTranslation) {
      return;
    }
    setTranslationStatus(null);
    setIsTranslatingRecipe(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(),
        messages: [
          {
            role: "user",
            content: `Translate this entire recipe into English. Return valid JSON with the same structure (title, description, notes, ingredients (amount/name/line), steps, tags). Do not add commentary.`,
          },
        ],
      });
      const normalized = cleanJsonText(response.reply);
      const parsed = extractJsonObject(normalized);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("ChefGPT did not return a valid translation.");
      }
      const translated: Recipe = {
        ...formData,
        title: String((parsed as Record<string, unknown>).title ?? formData.title ?? ""),
        description: String((parsed as Record<string, unknown>).description ?? formData.description ?? ""),
        notes: (parsed as Record<string, unknown>).notes
          ? String((parsed as Record<string, unknown>).notes)
          : formData.notes,
        ingredients: Array.isArray((parsed as Record<string, unknown>).ingredients)
          ? ((parsed as Record<string, unknown>).ingredients as RecipeIngredient[]).map((ingredient, index) => ({
              id: ingredient.id ?? formData.ingredients[index]?.id ?? crypto.randomUUID(),
              amount: ingredient.amount ?? "",
              name: ingredient.name ?? "",
              line: ingredient.line ?? [ingredient.amount, ingredient.name].filter(Boolean).join(" ") ?? "",
            }))
          : formData.ingredients,
        steps: Array.isArray((parsed as Record<string, unknown>).steps)
          ? ((parsed as Record<string, unknown>).steps as string[]).map((step) => String(step ?? ""))
          : formData.steps,
        tags: Array.isArray((parsed as Record<string, unknown>).tags)
          ? ((parsed as Record<string, unknown>).tags as string[]).map((tag) => String(tag ?? ""))
          : formData.tags,
      };
      applyTranslatedRecipe(translated);
      setTranslationStatus({
        type: "success",
        message: "Recipe translated to English. Please review for accuracy.",
      });
    } catch (error) {
      setTranslationStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to translate the recipe with ChefGPT right now.",
      });
    } finally {
      setIsTranslatingRecipe(false);
    }
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, ""],
    });
  };

  const updateStep = (index: number, value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = value;
    setFormData({ ...formData, steps: newSteps });
  };

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    });
  };

const updateTag = (index: number, value: string) => {
  const newTags = [...(formData.tags || [])];
  newTags[index] = value.toLowerCase();
  setFormData({ ...formData, tags: newTags });
};

  const addTag = () => {
    setFormData({
      ...formData,
      tags: [...(formData.tags || []), ""],
    });
  };

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      tags: (formData.tags || []).filter((_, i) => i !== index),
    });
  };

  const ingredientSummaries = formData.ingredients
    .map(describeIngredient)
    .filter((value) => value.length > 0);
  const descriptionText = (formData.description ?? "").trim();
  const missingIngredientAmounts = formData.ingredients.filter(
    (ingredient) => !ingredient.amount?.trim()
  );
  const hasIngredientAmounts =
    formData.ingredients.length > 0 &&
    formData.ingredients.every((ingredient) => Boolean(ingredient.amount?.trim()));
  const hasServings = typeof formData.servings === "number" && formData.servings > 0;
  const canGenerateSteps = ingredientSummaries.length > 0 && descriptionText.length >= 20;
  const canCalculateNutrition = hasServings && hasIngredientAmounts && ingredientSummaries.length > 0;
  const hasSteps = formData.steps.some((step) => step?.trim().length);
  const canSuggestTagsWithAI = descriptionText.length > 0 || hasSteps;
  const canGenerateDescription =
    Boolean(formData.title?.trim()) && ingredientSummaries.length > 0 && hasSteps;
  const hasIngredientDetails =
    formData.ingredients.length > 0 &&
    formData.ingredients.every((ingredient) =>
      Boolean(`${ingredient.name ?? ""} ${ingredient.line ?? ""}`.trim())
    );
  const hasRobustDescription = descriptionText.length >= 40;
  const hasSolidTitle = Boolean((formData.title ?? "").trim().length >= 5);
  const canAddIngredientUnits =
    missingIngredientAmounts.length > 0 &&
    hasIngredientDetails &&
    hasSolidTitle &&
    hasRobustDescription &&
    hasSteps;
  const existingIngredientUnits = Array.from(
    new Set(
      formData.ingredients
        .map((ingredient) => extractUnitLabelFromAmount(ingredient.amount))
        .filter((unit): unit is string => Boolean(unit))
    )
  );

  const buildAssistantRecipePayload = (): RecipeAssistantRecipePayload => ({
    title: formData.title || "Untitled Recipe",
    description: descriptionText,
    servings: formData.servings ? String(formData.servings) : undefined,
    prepTime: formData.prepTime ?? undefined,
    cookTime: formData.cookTime ?? undefined,
    totalTime: formData.totalTime ?? undefined,
    difficulty: formData.difficulty,
    mealType: formData.category,
    source: formData.source,
    tags: sanitizeTags(formData.tags),
    notes: formData.notes,
    ingredients: ingredientSummaries,
    steps: formData.steps.filter((step) => step?.trim().length),
  });

  const handleGenerateStepsWithAI = async () => {
    if (!canGenerateSteps || isGeneratingSteps) {
      return;
    }
    setStepsStatus(null);
    setIsGeneratingSteps(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(),
        messages: [
          {
            role: "user",
            content: `Generate a clear, logically ordered list of cooking steps for this recipe. Each step must be written in ${recipeLanguageLabel} and span 1–3 sentences, detailed enough to cook without being verbose. Respond ONLY in JSON with the shape {"steps": ["Step 1", "Step 2", ...]} and no commentary.`,
          },
        ],
      });
      const steps = parseStepsFromReply(response.reply);
      if (!steps.length) {
        throw new Error("The assistant response did not contain usable steps.");
      }
      setFormData((prev) => ({ ...prev, steps }));
      setStepsStatus({ type: "success", message: `Generated ${steps.length} steps with ChefGPT.` });
    } catch (error) {
      setStepsStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to generate steps with ChefGPT right now.",
      });
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  const handleGenerateDescriptionWithAI = async () => {
    if (!canGenerateDescription || isGeneratingDescription) {
      return;
    }
    setDescriptionStatus(null);
    setIsGeneratingDescription(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(),
        messages: [
          {
            role: "user",
            content: `Write at most two crisp sentences (maximum 200 characters total) in ${recipeLanguageLabel} that capture this recipe's key flavors and cooking style. Keep it punchy, no emojis, no lists—plain text only.`,
          },
        ],
      });
      const summary = limitToTwoSentences(response.reply, 200);
      if (!summary) {
        throw new Error("ChefGPT did not return a usable description.");
      }
      updateField("description", summary);
      setDescriptionStatus({
        type: "success",
        message: "ChefGPT wrote a concise description.",
      });
    } catch (error) {
      setDescriptionStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate a description with ChefGPT right now.",
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleAddIngredientUnits = async () => {
    if (!canAddIngredientUnits || isAddingIngredientUnits) {
      return;
    }
    setIngredientUnitsStatus(null);
    setIsAddingIngredientUnits(true);
    try {
      const missingEntries = missingIngredientAmounts.map((ingredient) => {
        const index = formData.ingredients.indexOf(ingredient);
        const safeId = ingredient.id ?? `missing-${index}`;
        return {
          id: safeId,
          index,
          label: ingredient.name || ingredient.line || `Ingredient ${index + 1}`,
          normalizedLabel: normalizeIngredientLabel(
            ingredient.name || ingredient.line || `Ingredient ${index + 1}`
          ),
        };
      });
      const preferredUnitsInstruction = existingIngredientUnits.length
        ? `Match these existing units when possible: ${existingIngredientUnits.join(", ")}.`
        : "Default to metric-friendly units such as g, ml, or kg.";
      const ingredientList = missingEntries
        .map((item) => `- id: ${item.id} | ingredient: ${item.label}`)
        .join("\n");
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(),
        messages: [
          {
            role: "user",
            content: `Some ingredients are missing quantities. Base your reasoning only on the recipe title, description, ingredient text, steps, and servings count—ignore photos, videos, or TikTok files. For each listed id, propose a realistic amount written in ${recipeLanguageLabel}. ${preferredUnitsInstruction} If no units exist yet, choose sensible metric units. Respond ONLY with JSON array [{"id":"...", "amount":"..."}] covering the ids below. Keep outputs short (e.g., "200 g"). Ingredients:\n${ingredientList}`,
          },
        ],
      });
      const normalized = cleanJsonText(response.reply);
      const parsed = extractJsonObject(normalized);
      const updates: Record<string, string> = {};
      const applyUpdate = (id?: string | null, amount?: string | null, fallbackLabel?: string | null) => {
        const cleanedAmount = amount?.trim();
        if (!cleanedAmount) {
          return;
        }
        let resolvedId = id?.trim();
        if (!resolvedId && fallbackLabel) {
          const normalized = normalizeIngredientLabel(fallbackLabel);
          const matched = normalized
            ? missingEntries.find((entry) => entry.normalizedLabel && entry.normalizedLabel === normalized)
            : undefined;
          if (matched) {
            resolvedId = matched.id;
          }
        }
        if (!resolvedId) {
          return;
        }
        updates[resolvedId] = cleanedAmount;
      };

      const accumulateUpdates = (value: unknown) => {
        if (!value) {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            if (entry && typeof entry === "object") {
              const typed = entry as Record<string, unknown>;
              applyUpdate(
                typeof typed.id === "string" ? typed.id : undefined,
                typeof typed.amount === "string" ? typed.amount : undefined,
                typeof typed.ingredient === "string"
                  ? typed.ingredient
                  : typeof typed.name === "string"
                    ? typed.name
                    : undefined
              );
            }
          });
          return;
        }
        if (typeof value === "object") {
          const record = value as Record<string, unknown>;
          if (Array.isArray(record.ingredients)) {
            accumulateUpdates(record.ingredients);
            return;
          }
          Object.entries(record).forEach(([key, entryValue]) => {
            if (typeof entryValue === "string") {
              applyUpdate(key, entryValue);
            } else if (entryValue && typeof entryValue === "object") {
              const typed = entryValue as Record<string, unknown>;
              applyUpdate(
                typeof typed.id === "string" ? typed.id : key,
                typeof typed.amount === "string"
                  ? typed.amount
                  : typeof typed.value === "string"
                    ? typed.value
                    : undefined,
                typeof typed.ingredient === "string"
                  ? typed.ingredient
                  : typeof typed.name === "string"
                    ? typed.name
                    : undefined
              );
            }
          });
        }
      };

      let updatesSource: unknown = parsed;
      if (!updatesSource) {
        try {
          updatesSource = JSON.parse(normalized);
        } catch {
          updatesSource = null;
        }
      }
      accumulateUpdates(updatesSource);
      if (!Object.keys(updates).length) {
        throw new Error("ChefGPT did not return any ingredient amounts.");
      }
      setFormData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ingredient, index) => {
          const identifier = ingredient.id ?? `missing-${index}`;
          const update = updates[identifier];
          if (!update) {
            return ingredient;
          }
          const updatedLine = ingredient.line?.trim()
            ? ingredient.line
            : [update, ingredient.name].filter(Boolean).join(" ").trim();
          return {
            ...ingredient,
            amount: update,
            line: updatedLine || ingredient.line,
          };
        }),
      }));
      setIngredientUnitsStatus({
        type: "success",
        message: "Ingredient amounts were generated with ChefGPT. Please verify—they may be inaccurate.",
      });
    } catch (error) {
      setIngredientUnitsStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to estimate ingredient amounts with ChefGPT right now.",
      });
    } finally {
      setIsAddingIngredientUnits(false);
    }
  };

  const handleCalculateNutritionWithAI = async () => {
    if (!canCalculateNutrition || isCalculatingNutrition) {
      return;
    }
    setNutritionStatus(null);
    setIsCalculatingNutrition(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(),
        messages: [
          {
            role: "user",
            content:
              "Estimate the per-serving nutrition for this recipe (calories, protein grams, carbs grams, fat grams) based on the ingredient list and their amounts. Respond ONLY in JSON like {\"calories\": number, \"protein\": \"10g\", \"carbs\": \"25g\", \"fat\": \"12g\"} using whole numbers.",
          },
        ],
      });
      const nutrition = parseNutritionFromReply(response.reply);
      if (!nutrition) {
        throw new Error("The assistant response did not contain nutrition data.");
      }
      setFormData((prev) => ({
        ...prev,
        nutrition: {
          ...prev.nutrition,
          calories: nutrition.calories ?? prev.nutrition?.calories,
          protein: nutrition.protein ?? prev.nutrition?.protein,
          carbs: nutrition.carbs ?? prev.nutrition?.carbs,
          fat: nutrition.fat ?? prev.nutrition?.fat,
        },
      }));
      setNutritionStatus({ type: "success", message: "Estimated nutrition facts with ChefGPT." });
    } catch (error) {
      setNutritionStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to calculate nutrition with ChefGPT right now.",
      });
    } finally {
      setIsCalculatingNutrition(false);
    }
  };

  const buildHeuristicTags = (current: Recipe): string[] => {
    const normalizedExisting = new Set(
      sanitizeTags(current.tags)
        .map(normalizeTagKey)
        .filter(Boolean)
    );
    const suggestions = new Map<string, string>();
    const text = `${current.title ?? ""} ${current.description ?? ""} ${current.notes ?? ""}`.toLowerCase();
    const ingredientsSummary = current.ingredients
      .map((ingredient) => `${ingredient.name ?? ""} ${ingredient.line ?? ""}`)
      .join(" ")
      .toLowerCase();
    const contains = (keyword: string) =>
      text.includes(keyword) || ingredientsSummary.includes(keyword);
    const addTag = (tag: string) => {
      const normalizedTag = tag.toLowerCase();
      if (!RECIPE_TAGS.includes(normalizedTag)) {
        return;
      }
      const normalized = normalizeTagKey(normalizedTag);
      if (!normalized || normalizedExisting.has(normalized) || suggestions.has(normalized)) {
        return;
      }
      suggestions.set(normalized, normalizedTag);
    };

    if (contains("vegan") || contains("plant-based") || contains("tofu")) addTag("vegan");
    if (contains("vegetarian") || contains("egg") || contains("cheese")) addTag("vegetarian");
    if (contains("gluten-free") || contains("almond flour")) addTag("gluten-free");
    if (contains("dairy-free") || contains("lactose")) addTag("dairy-free");
    if (contains("keto")) addTag("keto");
    if (contains("low carb") || contains("zoodle")) addTag("low-carb");
    if (contains("spicy") || contains("chili") || contains("sriracha")) addTag("spicy");
    if (contains("quick") || contains("15-minute") || contains("weeknight")) addTag("quick");
    if (contains("healthy") || contains("salad") || contains("fresh")) addTag("healthy");
    if (contains("comfort") || contains("creamy") || contains("casserole")) addTag("comfort food");
    if (contains("salad") || contains("greens") || contains("vinaigrette")) addTag("salad");
    if (contains("soup") || contains("broth") || contains("ramen") || contains("pho")) addTag("soup");
    if (contains("stew") || contains("goulash") || contains("ragout")) addTag("stew");
    if (contains("bbq") || contains("barbecue") || contains("smoked")) addTag("bbq");
    if (contains("grill") || contains("grilled")) addTag("grill");
    if (contains("side dish") || contains("side") || contains("garnish")) addTag("side dish");
    if (contains("meat") || contains("beef") || contains("pork") || contains("lamb") || contains("steak")) addTag("meat");
    if (contains("chicken") || contains("turkey") || contains("duck") || contains("poultry")) addTag("poultry");
    if (contains("seafood") || contains("fish") || contains("salmon") || contains("tuna") || contains("shrimp") || contains("prawn") || contains("crab")) addTag("seafood");
    if (contains("prep") || contains("batch")) addTag("meal prep");
    if (contains("budget") || contains("affordable") || contains("beans")) addTag("budget-friendly");
    if (contains("kid") || contains("family-friendly")) addTag("kids-friendly");
    if (contains("one pot") || contains("one-pot") || contains("skillet")) addTag("one-pot");
    if (contains("protein") || contains("chicken") || contains("tempeh")) addTag("high-protein");
    if (contains("snack") || contains("bite")) addTag("snack");
    if (contains("easy") || contains("simple") || contains("effortless")) addTag("easy");
    if (contains("bake") || contains("baked") || contains("pastry")) addTag("baking");
    if (contains("oven")) addTag("oven");
    if (contains("party") || contains("crowd") || contains("sharing")) addTag("party");
    if (contains("family")) addTag("family");
    if (contains("make ahead") || contains("make-ahead") || contains("overnight")) addTag("make-ahead");

    const mealKeywords: Record<string, string[]> = {
      "breakfast": ["breakfast", "brunch", "morning", "oats", "pancake", "smoothie"],
      "lunch": ["lunch", "midday", "salad bowl", "wrap"],
      "dinner": ["dinner", "supper", "evening", "pasta"],
      "dessert": ["dessert", "sweet", "cake", "cookie", "brownie"],
      "appetizer": ["appetizer", "starter", "finger food"],
    };
    Object.entries(mealKeywords).forEach(([tag, keywords]) => {
      if (keywords.some((keyword) => contains(keyword))) {
        addTag(tag);
      }
    });

    const cuisineKeywords: Record<string, string[]> = {
      "asian": ["asian", "thai", "japanese", "chinese", "korean", "vietnamese", "sichuan"],
      "american": ["american", "tex-mex", "southern", "new york"],
      "mediterranean": ["mediterranean", "greek", "italian", "spanish"],
      "european": ["european", "french", "german", "italian"],
      "latin american": ["latin american", "mexican", "peruvian", "argentinian"],
      "middle eastern": ["middle eastern", "lebanese", "persian", "turkish"],
      "north african": ["moroccan", "north african", "tagine"],
      "scandinavian": ["scandinavian", "swedish", "norwegian", "danish"],
    };
    Object.entries(cuisineKeywords).forEach(([tag, keywords]) => {
      if (keywords.some((keyword) => contains(keyword))) {
        addTag(tag);
      }
    });

    if (suggestions.size < 3) {
      RECIPE_TAGS.filter((tag) => {
        const normalized = normalizeTagKey(tag);
        return normalized && !normalizedExisting.has(normalized) && !suggestions.has(normalized);
      })
        .slice(0, Math.max(0, 3 - suggestions.size))
        .forEach(addTag);
    }

    return Array.from(suggestions.values());
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
      const match = normalized.match(/\[([\s\S]+)\]/);
      if (match) {
        raw = match[1]
          .split(",")
          .map((value) => value.replace(/["']/g, "").trim())
          .filter(Boolean);
      }
    }
    const normalizeTag = (tag: string) =>
      RECIPE_TAGS.find((candidate) => candidate.toLowerCase() === tag.toLowerCase());
    return raw
      .map((value) => String(value ?? "").trim())
      .map((value) => value.replace(/^["']|["']$/g, ""))
      .map(normalizeTag)
      .filter((tag): tag is string => Boolean(tag));
  };

  const applySuggestedTags = (nextTags: string[]): number => {
    let added = 0;
    setFormData((prev) => {
      const currentTags = sanitizeTags(prev.tags);
      const normalizedExisting = new Set(
        currentTags.map(normalizeTagKey).filter(Boolean)
      );
      const merged = [...currentTags];
      nextTags.forEach((tag) => {
        const lowerTag = (tag ?? "").toLowerCase();
        const normalized = normalizeTagKey(lowerTag);
        if (!tag || !normalized || normalizedExisting.has(normalized)) {
          return;
        }
        normalizedExisting.add(normalized);
        merged.push(lowerTag);
        added += 1;
      });
      return { ...prev, tags: merged };
    });
    return added;
  };

  const handleSuggestTagsWithAI = async () => {
    if (isSuggestingTags) {
      return;
    }
    setTagStatus(null);
    setIsSuggestingTags(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(),
        messages: [
          {
            role: "user",
            content: `Select the most relevant tags for this recipe using ONLY the following list: ${RECIPE_TAGS.join(
              ", "
            )}. Respond strictly in JSON like {"tags":["Tag1","Tag2"]} using the exact casing provided.`,
          },
        ],
      });
      let tags = parseTagsFromReply(response.reply);
      if (!tags.length) {
        tags = buildHeuristicTags(formData);
      }
      if (!tags.length) {
        throw new Error("ChefGPT could not determine relevant tags for this recipe.");
      }
      const added = applySuggestedTags(tags);
      setTagStatus({
        type: "success",
        message:
          added > 0
            ? `ChefGPT added ${added} tag${added === 1 ? "" : "s"} to this recipe.`
            : "All suggested tags were already applied.",
      });
    } catch (error) {
      const fallback = buildHeuristicTags(formData);
      if (fallback.length) {
        const added = applySuggestedTags(fallback);
        setTagStatus({
          type: "error",
          message:
            added > 0
              ? `ChefGPT is unavailable, but heuristics added ${added} tag${added === 1 ? "" : "s"}.`
              : "ChefGPT is unavailable and no additional tags were added.",
        });
      } else {
        setTagStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to suggest tags with ChefGPT right now.",
        });
      }
    } finally {
      setIsSuggestingTags(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl">Edit Recipe</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTranslateRecipe}
              disabled={!needsEnglishTranslation || isTranslatingRecipe}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-all ${translationButtonClasses}`}
            >
              {isTranslatingRecipe ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {translationButtonLabel}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
        {translationStatus && (
          <p
            className={`text-xs mt-2 ${
              translationStatus.type === "error" ? "text-red-500" : "text-gray-500"
            }`}
          >
            {translationStatus.message}
          </p>
        )}
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-sm text-gray-600">Basic Information</h2>
          
          <div>
            <label className="block text-xs text-gray-600 mb-2">Recipe Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
              placeholder="Enter recipe title"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs text-gray-600">Description</label>
              <button
                onClick={handleGenerateDescriptionWithAI}
                disabled={!canGenerateDescription || isGeneratingDescription}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all ${
                  canGenerateDescription
                    ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isGeneratingDescription ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isGeneratingDescription ? "Writing..." : "Write with AI"}
              </button>
            </div>
            <textarea
              value={formData.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm resize-none"
              rows={3}
              placeholder="Brief description of the recipe"
            />
            {(descriptionStatus || !canGenerateDescription) && (
              <p
                className={`text-xs ${
                  descriptionStatus?.type === "error" ? "text-red-500" : "text-gray-500"
                }`}
              >
                {descriptionStatus
                  ? descriptionStatus.message
                  : "Add a title, at least one ingredient, and a step to have ChefGPT summarize the recipe."}
              </p>
            )}
          </div>

        </div>

        {/* Recipe Image */}
        <div className="space-y-4">
          <h2 className="text-sm text-gray-600">Recipe Image</h2>
          
          {formData.thumbnail ? (
            <div className="space-y-3">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
                <NextImage
                  fill
                  sizes="400px"
                  src={formData.thumbnail}
                  alt={formData.title}
                  className="object-cover"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Change Image
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <Camera className="w-6 h-6 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-700 mb-1">Add Recipe Image</p>
                <p className="text-xs text-gray-500">Click to upload or drag and drop</p>
              </div>
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* TikTok Video Preview */}
        {showVideo && (
          <div className="space-y-4">
            <h2 className="text-sm text-gray-600">TikTok Video</h2>
            <div className="overflow-hidden rounded-2xl bg-black">
              <video
                src={formData.videoUrl}
                controls
                playsInline
                className="w-full h-64 object-cover"
              />
            </div>
            <p className="text-xs text-gray-500">
              This video was downloaded from TikTok and is attached to the recipe automatically.
            </p>
          </div>
        )}

        {/* Time & Servings */}
        <div className="space-y-4">
          <h2 className="text-sm text-gray-600">Time & Servings</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-2">Total Time</label>
              <input
                type="text"
                value={formData.totalTime || ""}
                onChange={(e) => updateField("totalTime", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                placeholder="e.g., 35 min"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-2">Servings</label>
              <input
                type="number"
                value={formData.servings || ""}
                onChange={(e) => updateField("servings", parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                placeholder="4"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Nutrition */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-gray-600">Nutrition (per serving)</h2>
            <button
              onClick={handleCalculateNutritionWithAI}
              disabled={!canCalculateNutrition || isCalculatingNutrition}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all ${
                canCalculateNutrition
                  ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {isCalculatingNutrition ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isCalculatingNutrition ? "Calculating..." : "Calculate with AI"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            AI nutrition estimates are approximate and may differ from lab-tested values.
          </p>
          {(nutritionStatus || !canCalculateNutrition) && (
            <p
              className={`text-xs mt-1 ${
                nutritionStatus?.type === "error" ? "text-red-500" : "text-gray-500"
              }`}
            >
              {nutritionStatus
                ? `${nutritionStatus.message} AI nutrition estimates are approximate.`
                : "Add servings plus ingredients with precise amounts to estimate nutrition with ChefGPT."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-2">Calories</label>
              <input
                type="number"
                value={formData.nutrition?.calories || ""}
                onChange={(e) => updateField("nutrition", {
                  ...formData.nutrition,
                  calories: parseInt(e.target.value) || undefined
                })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                placeholder="420"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-2">Protein</label>
              <input
                type="text"
                value={formData.nutrition?.protein || ""}
                onChange={(e) => updateField("nutrition", {
                  ...formData.nutrition,
                  protein: e.target.value
                })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                placeholder="12g"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-2">Carbs</label>
              <input
                type="text"
                value={formData.nutrition?.carbs || ""}
                onChange={(e) => updateField("nutrition", {
                  ...formData.nutrition,
                  carbs: e.target.value
                })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                placeholder="65g"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-2">Fat</label>
              <input
                type="text"
                value={formData.nutrition?.fat || ""}
                onChange={(e) => updateField("nutrition", {
                  ...formData.nutrition,
                  fat: e.target.value
                })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                placeholder="14g"
              />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm text-gray-600">Ingredients</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAddIngredientUnits}
                disabled={!canAddIngredientUnits || isAddingIngredientUnits}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all ${
                  isAddingIngredientUnits
                    ? "bg-gradient-to-br from-purple-400 to-purple-500 text-white opacity-80 cursor-wait"
                    : canAddIngredientUnits
                      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isAddingIngredientUnits ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isAddingIngredientUnits ? "Adding units..." : "Fill ingredient amounts"}
              </button>
              <button
                onClick={addIngredient}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1 text-xs"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>
          {ingredientUnitsStatus && (
            <p
              className={`text-xs ${
                ingredientUnitsStatus.type === "error" ? "text-red-500" : "text-gray-500"
              }`}
            >
              {ingredientUnitsStatus.message}
            </p>
          )}
          
          <div className="space-y-3">
            {formData.ingredients.map((ingredient, index) => (
              <div key={ingredient.id ?? index} className="flex gap-2 items-start">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <input
                    type="text"
                    value={ingredient.amount ?? ""}
                    onChange={(e) => updateIngredientField(index, "amount", e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                    placeholder="Amount (e.g., 2 tbsp)"
                  />
                  <input
                    type="text"
                    value={ingredient.name ?? ""}
                    onChange={(e) => updateIngredientField(index, "name", e.target.value)}
                    className="col-span-2 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
                    placeholder="Ingredient"
                  />
                </div>
                <button
                  onClick={() => removeIngredient(index)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm text-gray-600">Instructions</h2>
            <div className="flex flex-wrap gap-2">
              {canGenerateSteps && (
                <button
                  onClick={handleGenerateStepsWithAI}
                  disabled={isGeneratingSteps}
                  className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all ${
                    isGeneratingSteps
                      ? "bg-gradient-to-br from-purple-400 to-purple-500 text-white opacity-80 cursor-wait"
                      : "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
                  }`}
                >
                  {isGeneratingSteps ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isGeneratingSteps ? "Generating..." : "Generate Steps with AI"}
                </button>
              )}
              <button
                onClick={addStep}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1 text-xs"
              >
                <Plus className="w-3 h-3" />
                Add Step
              </button>
            </div>
          </div>
          {canGenerateSteps && (
            <p className="text-xs text-gray-500">
              ChefGPT instructions are suggestions—review them before cooking.
            </p>
          )}
          {(stepsStatus || !canGenerateSteps) && (
            <p
              className={`text-xs mt-1 ${
                stepsStatus?.type === "error" ? "text-red-500" : "text-gray-500"
              }`}
            >
              {stepsStatus
                ? `${stepsStatus.message} AI outputs might need adjustments.`
                : "Add a descriptive summary and at least one ingredient to enable ChefGPT."}
            </p>
          )}

          <div className="space-y-3">
            {formData.steps.map((step, index) => (
              <div key={index} className="flex gap-3">
                <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-2">
                  {index + 1}
                </div>
                <div className="flex-1 flex gap-2">
                  <textarea
                    value={step}
                    onChange={(e) => updateStep(index, e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm resize-none"
                    rows={2}
                    placeholder="Describe this step"
                  />
                  <button
                    onClick={() => removeStep(index)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm text-gray-600">Tags</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSuggestTagsWithAI}
                disabled={isSuggestingTags || !canSuggestTagsWithAI}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all ${
                  isSuggestingTags
                    ? "bg-gradient-to-br from-purple-400 to-purple-500 text-white opacity-80 cursor-wait"
                    : canSuggestTagsWithAI
                      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isSuggestingTags ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isSuggestingTags ? "Finding tags..." : "Suggest Tags with AI"}
              </button>
              <button
                onClick={addTag}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1 text-xs"
              >
                <Plus className="w-3 h-3" />
                Add Tag
              </button>
            </div>
          </div>

          {!canSuggestTagsWithAI && (
            <p className="text-xs text-gray-400">
              Add a description or at least one step to enable AI tag suggestions.
            </p>
          )}

          {tagStatus && (
            <p
              className={`text-xs ${
                tagStatus.type === "error" ? "text-red-500" : "text-gray-500"
              }`}
            >
              {tagStatus.message}
            </p>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-2">Selected Tags</label>
            {(formData.tags && formData.tags.length > 0) ? (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => {
                  const isQuick = RECIPE_TAGS.includes((tag ?? "").toLowerCase());
                  return (
                    <div
                      key={`${tag}-${index}`}
                      className="flex items-center gap-1 bg-gray-100 rounded-lg pl-3 pr-1 py-1"
                    >
                      {isQuick ? (
                        <span className="text-sm text-gray-700 capitalize">{tag}</span>
                      ) : (
                        <input
                          type="text"
                          value={tag}
                          onChange={(e) => updateTag(index, e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-24"
                          placeholder="Tag"
                        />
                      )}
                      <button
                        onClick={() => removeTag(index)}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No tags yet. Add or select one below.</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Suggested Tags</label>
            <div className="flex flex-wrap gap-2">
              {(showAllTags ? RECIPE_TAGS : RECIPE_TAGS.slice(0, POPULAR_RECIPE_TAG_COUNT)).map((quickTag) => {
                const isSelected = (formData.tags || []).includes(quickTag);
                return (
                  <button
                    key={quickTag}
                    onClick={() => {
                      if (isSelected) {
                        setFormData({
                          ...formData,
                          tags: (formData.tags || []).filter((t) => t !== quickTag),
                        });
                      } else {
                        setFormData({
                          ...formData,
                          tags: [...(formData.tags || []), quickTag],
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors capitalize ${
                      isSelected
                        ? "bg-black text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {quickTag}
                  </button>
                );
              })}
            </div>
            {RECIPE_TAGS.length > POPULAR_RECIPE_TAG_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllTags((prev) => !prev)}
                className="mt-3 text-xs text-gray-500 underline"
              >
                {showAllTags ? "Show fewer tags" : "Show all tags"}
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h2 className="text-sm text-gray-600">Chef&apos;s Notes</h2>
          <textarea
            value={formData.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm resize-none"
            rows={3}
            placeholder="Any additional tips or notes about this recipe"
          />
        </div>
      </div>
    </div>
  );
}
