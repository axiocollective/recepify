'use client';

import NextImage from "next/image";
import {
  ArrowLeft,
  Heart,
  Share,
  Clock,
  Users,
  Plus,
  Minus,
  Edit3,
  Sparkles,
  Send,
  X,
  PlayCircle,
  ExternalLink,
  Tag,
  StickyNote,
  ChefHat,
  Trash2,
  Loader2,
  ShoppingCart,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Recipe, RecipeIngredient } from "@/types/figma";
import { formatIngredientText } from "@/lib/utils";
import { askRecipeAssistant } from "@/lib/api";
import type { RecipeAssistantRecipePayload } from "@/types/assistant";
import {
  convertAmountToSystem,
  UNIT_SYSTEM_OPTIONS,
  type UnitSystem,
  toNumber,
  formatNumber,
} from "@/lib/unit-converter";
import { RECIPE_TAGS } from "@/constants/recipe-tags";

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  onStartCooking: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: (recipeId: string) => Promise<void> | void;
  onAddIngredientsToShoppingList?: (items: { name: string; amount?: string }[], recipe: Recipe) => void;
  onUpdateTags?: (recipe: Recipe, tags: string[]) => Promise<void> | void;
  showReviewPrompt?: boolean;
  onDismissReviewPrompt?: () => void;
}

type AssistantMessage = { role: "user" | "assistant"; text: string };

const QUICK_TAG_LIBRARY = RECIPE_TAGS;

const normalizeTagKey = (tag?: string | null) =>
  (tag ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const sanitizeTags = (tags?: string[]) =>
  (tags ?? [])
    .map((tag) => (tag ?? "").trim().toLowerCase())
    .filter((tag) => Boolean(tag) && !tag.startsWith("#"));

const parseSuggestedTags = (reply: string): string[] => {
  const cleaned = stripCodeFences(reply).trim();
  const parsed = extractJsonObject(cleaned);
  let raw: unknown[] = [];
  if (parsed) {
    if (Array.isArray((parsed as { tags?: unknown }).tags)) {
      raw = ((parsed as { tags?: unknown }).tags as unknown[]) ?? [];
    } else if (Array.isArray(parsed)) {
      raw = parsed as unknown[];
    }
  }
  if (!raw.length) {
    const match = cleaned.match(/\[([\s\S]+)\]/);
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

const buildHeuristicTags = (recipe: Recipe): string[] => {
  const normalizedExisting = new Set(
    sanitizeTags(recipe.tags)
      .map(normalizeTagKey)
      .filter(Boolean)
  );
  const suggestions = new Map<string, string>();
  const text = `${recipe.title ?? ""} ${recipe.description ?? ""} ${recipe.notes ?? ""}`.toLowerCase();
  const ingredientsSummary = recipe.ingredients
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
  if (contains("meat") || contains("beef") || contains("pork") || contains("lamb") || contains("steak"))
    addTag("meat");
  if (contains("chicken") || contains("turkey") || contains("duck") || contains("poultry")) addTag("poultry");
  if (contains("seafood") || contains("fish") || contains("salmon") || contains("tuna") || contains("shrimp") || contains("prawn") || contains("crab"))
    addTag("seafood");
  if (contains("prep") || contains("batch")) addTag("meal prep");
  if (contains("budget") || contains("affordable") || contains("beans")) addTag("budget-friendly");
  if (contains("kid") || contains("family-friendly")) addTag("kids-friendly");
  if (contains("one pot") || contains("one-pot") || contains("skillet")) addTag("one-pot");
  if (contains("protein") || contains("tempeh")) addTag("high-protein");
  if (contains("snack") || contains("bite")) addTag("snack");
  if (contains("easy") || contains("simple") || contains("effortless")) addTag("easy");
  if (contains("bake") || contains("baked") || contains("pastry")) addTag("baking");
  if (contains("oven")) addTag("oven");
  if (contains("party") || contains("crowd") || contains("sharing")) addTag("party");
  if (contains("family")) addTag("family");
  if (contains("make ahead") || contains("make-ahead") || contains("overnight")) addTag("make-ahead");

  const mealKeywords: Record<string, string[]> = {
    breakfast: ["breakfast", "brunch", "morning", "oats", "pancake", "smoothie"],
    lunch: ["lunch", "midday", "salad bowl", "wrap"],
    dinner: ["dinner", "supper", "evening", "pasta"],
    dessert: ["dessert", "sweet", "cake", "cookie", "brownie"],
    appetizer: ["appetizer", "starter", "finger food"],
  };
  Object.entries(mealKeywords).forEach(([tag, keywords]) => {
    if (keywords.some((keyword) => contains(keyword))) {
      addTag(tag);
    }
  });

  const cuisineKeywords: Record<string, string[]> = {
    asian: ["asian", "thai", "japanese", "chinese", "korean", "vietnamese", "sichuan"],
    american: ["american", "tex-mex", "southern", "new york"],
    mediterranean: ["mediterranean", "greek", "italian", "spanish"],
    european: ["european", "french", "german", "italian"],
    "latin american": ["latin american", "mexican", "peruvian", "argentinian"],
    "middle eastern": ["middle eastern", "lebanese", "persian", "turkish"],
    "north african": ["moroccan", "north african", "tagine"],
    scandinavian: ["scandinavian", "swedish", "norwegian", "danish"],
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
      .forEach((tag) => {
        const normalized = normalizeTagKey(tag);
        if (normalized && !suggestions.has(normalized)) {
          suggestions.set(normalized, tag);
        }
      });
  }

  return Array.from(suggestions.values());
};

const scaleAmountValue = (rawAmount: string, multiplier: number): string | null => {
  const trimmed = rawAmount.trim();
  if (!trimmed) {
    return null;
  }
  if (multiplier === 1) {
    return trimmed;
  }

  const rangeMatch = trimmed.match(/^([\d\s./]+)\s*(?:-|–|to)\s*([\d\s./]+)\s*(.*)$/i);
  if (rangeMatch) {
    const min = toNumber(rangeMatch[1]);
    const max = toNumber(rangeMatch[2]);
    if (min !== null && max !== null) {
      const scaledMin = formatNumber(min * multiplier);
      const scaledMax = formatNumber(max * multiplier);
      const suffix = rangeMatch[3]?.trim();
      return `${scaledMin}-${scaledMax}${suffix ? ` ${suffix}` : ""}`;
    }
  }

  const singleMatch = trimmed.match(/^([\d\s./]+)(.*)$/);
  if (singleMatch) {
    const quantity = toNumber(singleMatch[1]);
    if (quantity !== null) {
      const scaled = formatNumber(quantity * multiplier);
      const suffix = singleMatch[2]?.trim();
      return `${scaled}${suffix ? ` ${suffix}` : ""}`;
    }
  }

  return null;
};

const formatIngredientForDisplay = (
  ingredient: RecipeIngredient,
  multiplier: number
): string => {
  if (multiplier === 1) {
    return formatIngredientText(ingredient);
  }
  if (!ingredient.amount) {
    return formatIngredientText(ingredient);
  }
  const scaledAmount = scaleAmountValue(ingredient.amount, multiplier) ?? ingredient.amount;
  if (ingredient.name) {
    return `${scaledAmount} ${ingredient.name}`.trim();
  }
  return `${scaledAmount}`.trim();
};

const describeIngredient = (ingredient: RecipeIngredient): string => {
  const parts = [
    ingredient.amount?.trim(),
    (ingredient.name ?? ingredient.line)?.trim(),
  ].filter(Boolean);
  return parts.join(" ").trim();
};

const stripCodeFences = (text: string): string => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) {
    return match[1].trim();
  }
  return text.trim();
};

const removeTrailingCommas = (jsonLike: string): string =>
  jsonLike.replace(/,\s*(}|\])/g, "$1");

const extractJsonObject = (raw: string) => {
  const text = stripCodeFences(raw);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          const slice = removeTrailingCommas(text.slice(start, index + 1));
          try {
            return JSON.parse(slice);
          } catch {
            start = -1;
          }
        }
      }
    }
  }
  return null;
};

const parseStepsFromReply = (reply: string): string[] => {
  const normalized = stripCodeFences(reply);
  const parsed = extractJsonObject(normalized);
  let steps: string[] = [];
  if (parsed && Array.isArray(parsed.steps)) {
    steps = parsed.steps.map((step: unknown) => String(step ?? "").trim()).filter(Boolean);
  } else if (Array.isArray(parsed)) {
    steps = parsed.map((step: unknown) => String(step ?? "").trim()).filter(Boolean);
  }
  if (!steps.length) {
    const arrayMatch = normalized.match(/"steps"\s*:\s*\[([\s\S]*?)\]/i);
    const fallback = arrayMatch ? arrayMatch[1] : normalized;
    steps = fallback
      .split(/\n+/)
      .map((line) => line.trim())
      .map((line) => line.replace(/^[-*\d.)\s`]+/, ""))
      .map((line) => line.replace(/^"|",?$|"$/g, ""))
      .filter(
        (line) =>
          Boolean(line) && !/^(?:\{|\}|\[|\]|"?steps"?|json)$/i.test(line)
      );
  }
  return steps;
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

const parseNutritionFromReply = (reply: string) => {
  const normalized = stripCodeFences(reply);
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

  const regexPick = (keywords: string[]) => {
    const pattern = new RegExp(`(?:${keywords.join("|")})[^\\d]*(\\d+(?:[.,]\\d+)?)`, "i");
    const match = normalized.match(pattern);
    if (match) {
      return Number.parseFloat(match[1].replace(",", "."));
    }
    return undefined;
  };

  const calories = regexPick(["calories", "kcal", "cal"]);
  const protein = regexPick(["protein", "eiweiß", "eiweis"]);
  const carbs = regexPick(["carbs", "carbohydrates", "kohlenhydrate"]);
  const fat = regexPick(["fat", "fett"]);

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

interface AssistantSectionPayload {
  title?: string;
  content?: Array<string>;
}

interface AssistantStructuredReply {
  sections?: AssistantSectionPayload[];
}

const splitSectionLines = (value: string): string[] => {
  const parts = value
    .replace(/\s+-\s+/g, "\n- ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (parts.length > 1 && !parts[0].startsWith("-")) {
    parts[0] = `- ${parts[0]}`;
  }
  return parts.map((line) =>
    line.startsWith("-") ? `- ${line.replace(/^-+\s*/, "")}` : line
  );
};

const formatBoldSegments = (text: string): string => {
  if (!text.includes("**")) {
    return text;
  }
  return text.replace(/\*\*(.*?)\*\*/g, (_, inner) => `**${inner.trim()}**`);
};

const ensureTitleLineBreaks = (text: string): string =>
  text.replace(/(\*\*[^*]+?\*\*)[ \t]*/g, "$1\n");

const SENSITIVE_QUESTION_PATTERNS: RegExp[] = [
  /\bmedical\b/i,
  /\bmedicine\b/i,
  /\bdiagnos/i,
  /\bprescription\b/i,
  /\bmedication\b/i,
  /\ballerg/i,
  /\bpregnan/i,
  /\bbaby\b/i,
  /\binfant\b/i,
  /\bchild\b/i,
  /\btoddler\b/i,
  /\bdoctor\b/i,
  /\bhealth (?:issue|problem)\b/i,
  /\bpoison\b/i,
  /\btoxic\b/i,
  /\bfoodborne\b/i,
  /\bblood pressure\b/i,
  /\bdiabet/i,
  /\bcholesterol\b/i,
];

const isSensitiveQuestion = (question: string): boolean => {
  const normalized = question.toLowerCase();
  return SENSITIVE_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
};

const SENSITIVE_RESPONSE =
  "I’m not able to help with that. Please speak with a doctor or qualified professional for medical or safety advice.";

const buildMarkdownFromSections = (sections: AssistantSectionPayload[]): string | null => {
  const seenHashes = new Set<string>();
  if (!sections.length) {
    return null;
  }

  const formattedSections = sections.slice(0, 3).flatMap((section, sectionIndex) => {
    const title = (section.title ?? "ChefGPT").trim() || `ChefGPT ${sectionIndex + 1}`;
    const contentHash = JSON.stringify(section.content ?? []);
    const key = `${title}::${contentHash}`;
    if (seenHashes.has(key)) {
      return [];
    }
    seenHashes.add(key);
    const rawContent = Array.isArray(section.content)
      ? section.content
      : typeof section.content === "string"
      ? [section.content]
      : [];
    const lines = rawContent
      .flatMap((line) => splitSectionLines(typeof line === "string" ? line : ""))
      .slice(0, 4);

    const body = lines.length
      ? lines
          .map((line) => (line.startsWith("-") ? line : line))
          .join("\n")
      : "Still gathering helpful notes.";

    return `**${title}**\n${body}`;
  });

  return ensureTitleLineBreaks(formatBoldSegments(formattedSections.join("\n\n")));
};

const formatAssistantReply = (reply: string): string => {
  const cleaned = stripCodeFences(reply).trim();
  if (!cleaned) {
    return "I'm not sure how to help with that. Try asking about prep, storage, nutrition, or serving ideas.";
  }

  const parseStructuredReply = (): AssistantStructuredReply | null => {
    try {
      return JSON.parse(cleaned) as AssistantStructuredReply;
    } catch {
      const extracted = extractJsonObject(cleaned);
      if (extracted && typeof extracted === "object") {
        return extracted as AssistantStructuredReply;
      }
      return null;
    }
  };

  try {
    const parsed = parseStructuredReply();
    if (parsed && Array.isArray(parsed.sections)) {
      const markdown = buildMarkdownFromSections(parsed.sections);
      if (markdown) {
        const words = markdown.replace(/\*\*/g, "").split(/\s+/).filter(Boolean);
        if (words.length > 120) {
          const trimmed = words.slice(0, 120).join(" ");
          return `${trimmed}…`;
        }
        return markdown;
      }
    }
  } catch {
    // fall through to plain text
  }

  return ensureTitleLineBreaks(formatBoldSegments(cleaned));
};

const buildAssistantRecipePayload = (recipe: Recipe): RecipeAssistantRecipePayload => {
  const ingredientSummaries = recipe.ingredients.map(describeIngredient).filter(Boolean);
  return {
    title: recipe.title || "Untitled Recipe",
    description: recipe.description ?? "",
    servings: recipe.servings ? String(recipe.servings) : undefined,
    prepTime: recipe.prepTime ?? undefined,
    cookTime: recipe.cookTime ?? undefined,
    totalTime: recipe.totalTime ?? undefined,
    difficulty: recipe.difficulty,
    mealType: recipe.category,
    source: recipe.source,
    tags: recipe.tags ?? [],
    notes: recipe.notes,
    ingredients: ingredientSummaries,
    steps: (recipe.steps ?? []).filter((step) => step?.trim().length),
  };
};

type AiStatus = { type: "success" | "error"; message: string } | null;

export function RecipeDetail({
  recipe,
  onBack,
  onStartCooking,
  onToggleFavorite,
  onEdit,
  onDelete,
  onAddIngredientsToShoppingList,
  onUpdateTags,
  showReviewPrompt = false,
  onDismissReviewPrompt,
}: RecipeDetailProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("original");
  const [currentServings, setCurrentServings] = useState(recipe.servings || 1);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [generatedSteps, setGeneratedSteps] = useState<string[] | null>(null);
  const [generatedNutrition, setGeneratedNutrition] = useState<Recipe["nutrition"] | null>(null);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false);
  const [stepsStatus, setStepsStatus] = useState<AiStatus>(null);
  const [nutritionStatus, setNutritionStatus] = useState<AiStatus>(null);
  const [shoppingStatus, setShoppingStatus] = useState<AiStatus>(null);
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const [shareStatus, setShareStatus] = useState<AiStatus>(null);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [customTagValue, setCustomTagValue] = useState("");
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [tagSuggestionStatus, setTagSuggestionStatus] = useState<AiStatus>(null);
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const isReviewPromptVisible = Boolean(showReviewPrompt);
  const handleDismissReviewPrompt = () => {
    onDismissReviewPrompt?.();
  };
  const handleReviewEdit = () => {
    onDismissReviewPrompt?.();
    onEdit();
  };
  const assistantSystemPrompt =
    "You are ChefGPT (BETA), an intelligent yet lovable AI sous-chef.\n\nScope:\n• Answer only food-, cooking-, and nutrition-related questions about the provided recipe (ingredients, steps, techniques, substitutions, variations, serving, storage, taste, difficulty, health).\n• Always inspect the recipe data (title, description, ingredients, steps, times, servings, nutrition, tags) and cite it directly when possible.\n• If information is missing, clearly say it’s not saved yet, then offer helpful guidance based on the rest of the recipe and your culinary knowledge.\n• Politely decline questions that are off-topic or sensitive and redirect to cooking or this recipe.\n\nOutput format (mandatory):\nReturn valid JSON exactly like this:\n{\n  \"sections\": [\n    {\n      \"title\": \"Title\",\n      \"content\": [\n        \"Short sentence or bullet (start with -)\",\n        \"Another concise sentence or bullet\"\n      ]\n    }\n  ]\n}\n\nFormatting rules:\n• Max 3 sections per answer.\n• Max 120 words across all sections unless the user explicitly asks for detailed instructions.\n• Use bold headers in the UI by supplying `title` text; the renderer will wrap it with **Title** and a blank line.\n• Keep each sentence or bullet concise (1 idea each). Use \"- \" prefix when you intend a bullet; otherwise use plain sentences.\n• Maintain a warm, encouraging tone and avoid redundancy.\n\nFollow these instructions for every response.";

  useEffect(() => {
    setCurrentServings(recipe.servings || 1);
    setGeneratedSteps(null);
    setGeneratedNutrition(null);
    setStepsStatus(null);
    setNutritionStatus(null);
    setShoppingStatus(null);
    setCheckedIngredients(new Set());
    setIsImageOverlayOpen(false);
    setIsTagPickerOpen(false);
    setCustomTagValue("");
    setTagUpdateError(null);
    setIsSuggestingTags(false);
    setTagSuggestionStatus(null);
    setIsUpdatingTags(false);
    setShareStatus(null);
  }, [recipe.id, recipe.servings]);

  useEffect(() => {
    if (shoppingStatus?.type === "success") {
      const timeout = window.setTimeout(() => {
        setShoppingStatus(null);
      }, 2500);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [shoppingStatus]);

  useEffect(() => {
    if (shareStatus) {
      const timeout = window.setTimeout(() => {
        setShareStatus(null);
      }, 2500);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [shareStatus]);
  useEffect(() => {
    if (showReviewPrompt && isAssistantOpen) {
      setIsAssistantOpen(false);
    }
  }, [showReviewPrompt, isAssistantOpen]);

  const originalServings = recipe.servings || 1;
  const isScannedRecipe = recipe.source === "scan";
  const showHeroImage = Boolean(recipe.thumbnail && !isScannedRecipe);
  const servingsMultiplier = originalServings ? currentServings / originalServings : 1;
  const stepsToDisplay = generatedSteps ?? recipe.steps ?? [];
  const nutritionToDisplay = generatedNutrition ?? recipe.nutrition;
  const hasInstructions = Array.isArray(stepsToDisplay) && stepsToDisplay.length > 0;
  const hasDownloadedVideo = Boolean(recipe.videoUrl) && !isScannedRecipe;
  const shouldShowTikTokPlaceholder =
    !isScannedRecipe && recipe.source === "tiktok" && !hasDownloadedVideo && Boolean(recipe.sourceUrl);
  const hasNutrition = Boolean(
    nutritionToDisplay &&
      (nutritionToDisplay.calories ||
        nutritionToDisplay.protein ||
        nutritionToDisplay.carbs ||
        nutritionToDisplay.fat)
  );
  const addedLabel = recipe.importedAt ? formatAddedDate(recipe.importedAt) : null;
  const ingredientSummaries = recipe.ingredients.map(describeIngredient).filter((value) => value.length > 0);
  const descriptionText = (recipe.description ?? "").trim();
  const hasIngredientAmounts =
    recipe.ingredients.length > 0 &&
    recipe.ingredients.every((ingredient) => Boolean(ingredient.amount?.trim()));
  const hasServings = Boolean(recipe.servings && recipe.servings > 0);
  const canSuggestTagsWithAI =
    descriptionText.length > 0 ||
    (recipe.steps ?? []).some((step) => (step ?? "").trim().length > 0);
  const canGenerateStepsWithAI = ingredientSummaries.length > 0 && descriptionText.length >= 20;
  const canCalculateNutritionWithAI = hasServings && hasIngredientAmounts;
  const shouldShowInstructionsSection = hasInstructions || canGenerateStepsWithAI;
  const shouldShowNutritionSection = hasNutrition || canCalculateNutritionWithAI;
  const canSendToShoppingList = Boolean(onAddIngredientsToShoppingList);
  const canShowScannedOriginal = isScannedRecipe && Boolean(recipe.thumbnail);
  const shouldShowOriginalButton =
    (!isScannedRecipe && Boolean(recipe.sourceUrl)) || canShowScannedOriginal;
  const convertedIngredients = useMemo(() => {
    if (unitSystem === "original") {
      return recipe.ingredients;
    }
    return recipe.ingredients.map((ingredient) => {
      if (!ingredient.amount) {
        return ingredient;
      }
      const converted = convertAmountToSystem(ingredient.amount, unitSystem);
      if (!converted) {
        return ingredient;
      }
      return { ...ingredient, amount: converted };
    });
  }, [recipe.ingredients, unitSystem]);
  const existingTags = sanitizeTags(recipe.tags);
  const normalizedTagSet = new Set(existingTags.map((tag) => tag.toLowerCase()));
  const canInlineEditTags = Boolean(onUpdateTags);
  const hasJustAddedToList = shoppingStatus?.type === "success";
  const selectedIngredientsCount = checkedIngredients.size;
  const addToListDisabled = selectedIngredientsCount === 0;
  const addToListLabel = hasJustAddedToList
    ? "Added!"
    : selectedIngredientsCount > 1
      ? "Add items"
      : "Add item";

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const adjustServings = (delta: number) => {
    const newServings = Math.max(1, currentServings + delta);
    setCurrentServings(newServings);
  };

  const MAX_USER_MESSAGES = 5;

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isAssistantThinking) return;
    const userMessagesCount = messages.filter((message) => message.role === "user").length;
    if (userMessagesCount >= MAX_USER_MESSAGES) {
      setInputText("");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "You've reached the limit of five questions for this recipe. Give me a break, I'm only a beta sous chef!",
        },
      ]);
      return;
    }
    const question = trimmed;
    const userMessage: AssistantMessage = { role: "user", text: question };
    setInputText("");

    if (isSensitiveQuestion(question)) {
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          text: SENSITIVE_RESPONSE,
        },
      ]);
      return;
    }

    const conversationHistory = [...messages, userMessage].map(({ role, text }) => ({
      role,
      content: text,
    }));
    const thinkingMessage: AssistantMessage = { role: "assistant", text: "ChefGPT is thinking…" };
    setMessages((prev) => [...prev, userMessage, thinkingMessage]);

    setIsAssistantThinking(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(recipe),
        messages: [
          {
            role: "assistant",
            content: assistantSystemPrompt,
          },
          ...conversationHistory,
        ],
      });
      const reply = formatAssistantReply(response.reply);
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", text: reply }]);
    } catch (error) {
      console.error("Failed to contact ChefGPT assistant", error);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", text: "Sorry, I couldn't reach ChefGPT right now. Please try again in a moment." },
      ]);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  const assistantSuggestions = [
    "Need tips for this recipe?",
    "How long do leftovers last?",
    "Can I make it vegan?",
    "How can I save time?",
  ];

  const handleGenerateStepsWithAI = async () => {
    if (!canGenerateStepsWithAI || isGeneratingSteps) {
      return;
    }
    setStepsStatus(null);
    setIsGeneratingSteps(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(recipe),
        messages: [
          {
            role: "user",
            content:
              "Generate a clear, logically ordered list of cooking steps for this recipe. Respond ONLY in JSON with the shape {\"steps\": [\"Step 1\", ...]}. Each step should be 1–3 sentences, detailed enough to cook without being verbose.",
          },
        ],
      });
      const steps = parseStepsFromReply(response.reply);
      if (!steps.length) {
        throw new Error("ChefGPT was unable to create instructions for this recipe.");
      }
      setGeneratedSteps(steps);
      setStepsStatus({
        type: "success",
        message: `Generated ${steps.length} steps with ChefGPT.`,
      });
    } catch (error) {
      setStepsStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate steps with ChefGPT right now.",
      });
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  const handleCalculateNutritionWithAI = async () => {
    if (!canCalculateNutritionWithAI || isCalculatingNutrition) {
      return;
    }
    setNutritionStatus(null);
    setIsCalculatingNutrition(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(recipe),
        messages: [
          {
            role: "user",
            content:
              "Estimate the per-serving nutrition for this recipe (calories, protein grams, carbs grams, fat grams) based on the ingredient list and their amounts. Respond ONLY in JSON like {\"calories\": number, \"protein\": \"10g\", \"carbs\": \"25g\", \"fat\": \"12g\"}.",
          },
        ],
      });
      const nutrition = parseNutritionFromReply(response.reply);
      if (!nutrition) {
        throw new Error("ChefGPT did not return nutrition information.");
      }
      setGeneratedNutrition((prev) => ({
        ...prev,
        calories: nutrition.calories ?? prev?.calories,
        protein: nutrition.protein ?? prev?.protein,
        carbs: nutrition.carbs ?? prev?.carbs,
        fat: nutrition.fat ?? prev?.fat,
      }));
      setNutritionStatus({
        type: "success",
        message: "Estimated nutrition with ChefGPT.",
      });
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

  const handleAddSelectedIngredientsToShoppingList = () => {
    if (!canSendToShoppingList || checkedIngredients.size === 0) {
      return;
    }
    const items = Array.from(checkedIngredients)
      .map((index) => {
        const ingredient = convertedIngredients[index] ?? recipe.ingredients[index];
        if (!ingredient) {
          return null;
        }
        const amount = ingredient.amount
          ? scaleAmountValue(ingredient.amount, servingsMultiplier) ?? ingredient.amount
          : undefined;
        const name =
          ingredient.name?.trim() ||
          ingredient.line?.trim() ||
          formatIngredientText(ingredient).trim();
        if (!name) {
          return null;
        }
        return { name, amount };
      })
      .filter((item): item is { name: string; amount: string | undefined } => Boolean(item));
    if (!items.length) {
      setShoppingStatus({ type: "error", message: "Please select at least one ingredient." });
      return;
    }
    onAddIngredientsToShoppingList?.(items, recipe);
    setShoppingStatus({
      type: "success",
      message: `Added ${items.length} ingredient${items.length === 1 ? "" : "s"} to your shopping list.`,
    });
  };

  const handleApplyTags = async (nextTags: string[]): Promise<number> => {
    if (!onUpdateTags) {
      return 0;
    }
    setIsUpdatingTags(true);
    setTagUpdateError(null);
    const previousTagSet = new Set(existingTags.map((tag) => tag.toLowerCase()));
    try {
      const normalizedTags = nextTags
        .map((tag) => (tag ?? "").trim().toLowerCase())
        .filter((tag) => tag.length > 0);
      const uniqueTags: string[] = [];
      const seen = new Set<string>();
      normalizedTags.forEach((tag) => {
        if (seen.has(tag)) {
          return;
        }
        seen.add(tag);
        uniqueTags.push(tag);
      });
      await onUpdateTags(recipe, uniqueTags);
      setCustomTagValue("");
      let added = 0;
      uniqueTags.forEach((tag) => {
        if (!previousTagSet.has(tag)) {
          added += 1;
          previousTagSet.add(tag);
        }
      });
      return added;
    } catch (error) {
      setTagUpdateError(
        error instanceof Error ? error.message : "Unable to update tags right now."
      );
      return 0;
    } finally {
      setIsUpdatingTags(false);
    }
  };

  const handleAddTagInline = (tag: string) => {
    if (!canInlineEditTags || isUpdatingTags) {
      return;
    }
    const trimmed = tag.trim();
    if (!trimmed) {
      return;
    }
    const lower = trimmed.toLowerCase();
    if (normalizedTagSet.has(lower)) {
      return;
    }
    void handleApplyTags([...existingTags, lower]);
  };

  const handleCustomTagSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = customTagValue.trim();
    if (!trimmed || isUpdatingTags) {
      return;
    }
    void handleApplyTags([...existingTags, trimmed.toLowerCase()]);
  };

  const handleSuggestTagsWithAI = async () => {
    if (!canInlineEditTags || isSuggestingTags || !canSuggestTagsWithAI) {
      return;
    }
    setTagSuggestionStatus(null);
    setIsSuggestingTags(true);
    try {
      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(recipe),
        messages: [
          {
            role: "user",
            content: `Select the most relevant tags for this recipe using ONLY the following list: ${RECIPE_TAGS.join(
              ", "
            )}. Respond strictly in JSON like {"tags":["Tag1","Tag2"]} using the exact casing provided.`,
          },
        ],
      });
      let tags = parseSuggestedTags(response.reply);
      if (!tags.length) {
        tags = buildHeuristicTags(recipe);
      }
      if (!tags.length) {
        throw new Error("ChefGPT could not determine relevant tags for this recipe.");
      }
      const added = await handleApplyTags([...existingTags, ...tags]);
      setTagSuggestionStatus({
        type: "success",
        message:
          added > 0
            ? `ChefGPT added ${added} tag${added === 1 ? "" : "s"} to this recipe.`
            : "All suggested tags were already applied.",
      });
    } catch (error) {
      const fallback = buildHeuristicTags(recipe);
      if (fallback.length) {
        const added = await handleApplyTags([...existingTags, ...fallback]);
        setTagSuggestionStatus({
          type: "error",
          message:
            added > 0
              ? `ChefGPT is offline, but heuristics added ${added} tag${added === 1 ? "" : "s"}.`
              : "ChefGPT is offline and no new tags were added.",
        });
      } else {
        setTagSuggestionStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "ChefGPT did not return any tags. Try again later.",
        });
      }
    } finally {
      setIsSuggestingTags(false);
    }
  };

  const handleShareRecipe = async () => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = `${baseUrl.replace(/\/$/, "")}/share/${recipe.id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: recipe.title,
          text: recipe.description ?? "Check out this recipe.",
          url,
        });
        setShareStatus({ type: "success", message: "Shared via system sheet." });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus({ type: "success", message: "Link copied to clipboard." });
        return;
      }
      setShareStatus({ type: "error", message: url });
    } catch (error) {
      setShareStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to share right now.",
      });
    }
  };

  return (
    <>
      <div className="min-h-screen bg-white pb-8 relative">
      <div className="relative h-80">
        {showHeroImage ? (
          <NextImage
            fill
            sizes="100vw"
            src={recipe.thumbnail as string}
            alt={recipe.title}
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gray-100" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
          <button
            onClick={onBack}
            className="w-11 h-11 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="w-11 h-11 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all shadow-lg"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleFavorite}
              className="w-11 h-11 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all shadow-lg"
            >
              <Heart className={`w-5 h-5 ${recipe.isFavorite ? "fill-black text-black" : ""}`} />
            </button>
            <button
              onClick={handleShareRecipe}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg ${
                shareStatus?.type === "success"
                  ? "bg-black/90 text-white hover:bg-black"
                  : "bg-white/95 backdrop-blur-sm hover:bg-white"
              }`}
            >
              <Share className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(recipe.id)}
              className="w-11 h-11 bg-red-500/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {shareStatus && (
          <div className="absolute top-20 right-4">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-medium shadow-lg ${
                shareStatus.type === "error"
                  ? "bg-red-600/95 text-white"
                  : "bg-white/95 text-gray-900"
              }`}
            >
              {shareStatus.message}
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6">
          {recipe.source && (
            <div className="inline-block px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg text-white text-xs font-medium mb-3">
              {getPlatformDisplay(recipe.source)}
            </div>
          )}
          <h1 className="text-3xl text-white font-semibold mb-2">{recipe.title}</h1>
          {addedLabel && <p className="text-sm text-white/80">Added {addedLabel}</p>}
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {isReviewPromptVisible && (
          <div className="border border-gray-200 bg-gray-50 rounded-2xl p-4 space-y-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-900">Double-check this recipe</p>
              <p className="text-xs text-gray-600">
                Make sure the import looks correct before cooking. Jump into edit mode if anything needs tweaks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleReviewEdit}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-full text-xs font-medium bg-white text-gray-900 border border-gray-200 hover:border-gray-400 transition-colors"
              >
                Edit recipe
              </button>
              <button
                onClick={handleDismissReviewPrompt}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-full text-xs font-medium bg-black text-white hover:bg-gray-800 transition-colors"
              >
                Looks good
              </button>
            </div>
          </div>
        )}
        {shouldShowOriginalButton &&
          (isScannedRecipe && canShowScannedOriginal ? (
            <button
              type="button"
              onClick={() => setIsImageOverlayOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition-colors border border-gray-200"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View original recipe</span>
            </button>
          ) : (
            recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition-colors border border-gray-200"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View original on {getPlatformDisplay(recipe.source)}</span>
              </a>
            )
          ))}

        {recipe.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{recipe.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {recipe.totalTime && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{recipe.totalTime}</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{recipe.servings} servings</span>
            </div>
          )}
        </div>

        <div className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Tags</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {existingTags.length > 0 ? (
              existingTags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-full text-xs capitalize"
                >
                  {tag}
                </span>
              ))
            ) : (
              <p className="text-xs text-gray-500">No tags yet. Add one to organize this recipe.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {canInlineEditTags && (
              <button
                onClick={() => setIsTagPickerOpen((prev) => !prev)}
                disabled={isUpdatingTags}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  isUpdatingTags
                    ? "bg-gray-100 text-gray-400 cursor-wait"
                    : "bg-white border-gray-200 hover:border-gray-400"
                }`}
              >
                {isTagPickerOpen ? "Close tag picker" : "+ Add tag"}
              </button>
            )}
            {!canInlineEditTags && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 rounded-full text-xs border border-gray-200 bg-white hover:border-gray-400"
              >
                + Add tag
              </button>
            )}
            {canInlineEditTags && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 rounded-full text-xs border border-gray-200 bg-white hover:border-gray-400"
              >
                Edit tags
              </button>
            )}
          </div>
          {tagUpdateError && (
            <p className="text-xs text-red-500 mt-2">{tagUpdateError}</p>
          )}
          {canInlineEditTags && isTagPickerOpen && (
            <div className="mt-4 border border-dashed border-gray-200 rounded-lg p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Quick picks</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAG_LIBRARY.map((tag) => {
                    const disabled = normalizedTagSet.has(tag.toLowerCase()) || isUpdatingTags;
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleAddTagInline(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors capitalize ${
                          disabled
                            ? "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed"
                            : "bg-white border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pt-2 border-t border-dashed border-gray-200 space-y-2">
                <button
                  type="button"
                  onClick={handleSuggestTagsWithAI}
                  disabled={isSuggestingTags || !canSuggestTagsWithAI}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    isSuggestingTags || !canSuggestTagsWithAI
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm hover:from-purple-600 hover:to-purple-700"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {isSuggestingTags ? "Finding tags..." : "Suggest tags with AI"}
                </button>
                {tagSuggestionStatus && (
                  <p
                    className={`text-xs ${
                      tagSuggestionStatus.type === "success" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {tagSuggestionStatus.message}
                  </p>
                )}
                {!canSuggestTagsWithAI && (
                  <p className="text-xs text-gray-400">
                    Add a description or at least one step to enable AI tag suggestions.
                  </p>
                )}
              </div>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => handleCustomTagSubmit(event)}
              >
                <input
                  type="text"
                  value={customTagValue}
                  onChange={(event) => setCustomTagValue(event.target.value.toLowerCase())}
                  placeholder="Custom tag"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
                <button
                  type="submit"
                  disabled={isUpdatingTags || !customTagValue.trim()}
                  className={`px-3 py-2 rounded-lg text-xs font-medium ${
                    customTagValue.trim() && !isUpdatingTags
                      ? "bg-black text-white hover:bg-gray-900"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isUpdatingTags ? "Saving…" : "Add custom tag"}
                </button>
              </form>
            </div>
          )}
        </div>

        {recipe.servings && (
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Adjust Servings</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjustServings(-1)}
                  disabled={currentServings <= 1}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    currentServings <= 1
                      ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-lg min-w-[2.5rem] text-center font-medium">
                  {currentServings}
                </span>
                <button
                  onClick={() => adjustServings(1)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {currentServings !== originalServings && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Adjusted from {originalServings} serving{originalServings !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        <div className="border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-sm font-medium text-gray-900">Ingredients</h2>
            {canSendToShoppingList && (
              <button
                onClick={handleAddSelectedIngredientsToShoppingList}
                disabled={addToListDisabled || hasJustAddedToList}
                className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 transition-colors ${
                  addToListDisabled
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : hasJustAddedToList
                      ? "bg-emerald-500 text-white cursor-default"
                      : "bg-black text-white hover:bg-gray-900"
                }`}
              >
                {hasJustAddedToList ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {addToListLabel}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {addToListLabel}
                  </>
                )}
              </button>
            )}
          </div>
          {convertedIngredients.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ChefGPT unit converter</span>
                </div>
                <div className="flex rounded-full bg-gray-100 p-1 text-xs">
                  {UNIT_SYSTEM_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setUnitSystem(option.value)}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        unitSystem === option.value
                          ? "bg-white shadow text-gray-900"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {unitSystem !== "original" && (
                <p className="text-xs text-gray-500 mb-3">
                  ChefGPT converted these ingredients to {unitSystem === "metric" ? "metric" : "US"} units.
                </p>
              )}
              <div className="space-y-2.5">
                {convertedIngredients.map((ingredient, index) => (
                  <label key={ingredient.id ?? index} className="flex items-start gap-3 group cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkedIngredients.has(index)}
                      onChange={() => toggleIngredient(index)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black focus:ring-offset-0"
                    />
                    <span
                      className={`text-sm leading-relaxed transition-all ${
                        checkedIngredients.has(index) ? "line-through text-gray-400" : "text-gray-700"
                      }`}
                    >
                      {formatIngredientForDisplay(ingredient, servingsMultiplier) ||
                        formatIngredientText(ingredient)}
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <button
              onClick={onEdit}
              className="w-full py-4 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              + Add Ingredients
            </button>
          )}
          {shoppingStatus && (
            <p
              className={`text-xs mt-3 ${
                shoppingStatus.type === "error" ? "text-red-500" : "text-gray-500"
              }`}
            >
              {shoppingStatus.message}
            </p>
          )}
        </div>

        {shouldShowInstructionsSection && (
          <div className="border border-gray-100 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-medium text-gray-900">Instructions</h2>
              {!hasInstructions && canGenerateStepsWithAI && (
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
            </div>
            {!hasInstructions && canGenerateStepsWithAI && (
              <p className="text-xs text-gray-500 mb-4">
                ChefGPT instructions are suggestions—please review for accuracy.
              </p>
            )}
            {stepsStatus && (
              <p
                className={`text-xs mb-4 ${
                  stepsStatus.type === "error" ? "text-red-500" : "text-gray-500"
                }`}
              >
                {`${stepsStatus.message} AI outputs might need adjustments.`}
              </p>
            )}

            {hasDownloadedVideo && (
              <div className="mb-6">
                <div className="relative rounded-lg overflow-hidden bg-black max-h-[500px]">
                  <video
                    src={recipe.videoUrl}
                    controls
                    playsInline
                    poster={recipe.thumbnail}
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}

            {shouldShowTikTokPlaceholder && (
              <div className="mb-6">
                <div className="relative aspect-[9/16] max-h-[500px] bg-gray-100 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="w-16 h-16 text-white opacity-80" />
                  </div>
                  <p className="absolute bottom-4 left-4 right-4 text-xs text-white/80 text-center">
                    TikTok video preview
                  </p>
                </div>
              </div>
            )}

            {hasInstructions ? (
              <div className="space-y-5">
                {stepsToDisplay.map((step, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="w-7 h-7 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium">
                      {index + 1}
                    </div>
                    <p className="flex-1 pt-1 text-sm text-gray-700 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full py-6 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 text-center">
                ChefGPT can create the missing steps once you tap “Generate Steps with AI”.
              </div>
            )}
          </div>
        )}

        <div className="border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <StickyNote className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-medium text-gray-900">Notes</h2>
          </div>
          {recipe.notes ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-sm text-gray-700 leading-relaxed">{recipe.notes}</p>
            </div>
          ) : (
            <button
              onClick={onEdit}
              className="w-full py-4 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              + Add Note
            </button>
          )}
        </div>

        {shouldShowNutritionSection && (
          <div className="border border-gray-100 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-medium text-gray-900">Nutrition per serving</h2>
              {canCalculateNutritionWithAI && !hasNutrition && (
                <button
                  onClick={handleCalculateNutritionWithAI}
                  disabled={isCalculatingNutrition}
                  className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all ${
                    isCalculatingNutrition
                      ? "bg-gradient-to-r from-purple-400 to-purple-500 text-white opacity-80 cursor-wait"
                      : "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:shadow-md"
                  }`}
                >
                  {isCalculatingNutrition ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isCalculatingNutrition ? "Calculating..." : "Calculate with AI"}
                </button>
              )}
            </div>
            {canCalculateNutritionWithAI && !hasNutrition && (
              <p className="text-xs text-gray-500 mb-4">
                AI nutrition estimates are approximate and should not replace professional analysis.
              </p>
            )}
            {nutritionStatus && (
              <p
                className={`text-xs mb-4 ${
                  nutritionStatus.type === "error" ? "text-red-500" : "text-gray-500"
                }`}
              >
                {`${nutritionStatus.message} AI nutrition estimates may differ from lab-tested values.`}
              </p>
            )}
            {hasNutrition ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {nutritionToDisplay?.calories && (
                  <div className="text-center">
                    <div className="text-lg font-medium">{nutritionToDisplay.calories}</div>
                    <div className="text-xs text-gray-500 mt-1">Calories</div>
                  </div>
                )}
                {nutritionToDisplay?.protein && (
                  <div className="text-center">
                    <div className="text-lg font-medium">{nutritionToDisplay.protein}</div>
                    <div className="text-xs text-gray-500 mt-1">Protein</div>
                  </div>
                )}
                {nutritionToDisplay?.carbs && (
                  <div className="text-center">
                    <div className="text-lg font-medium">{nutritionToDisplay.carbs}</div>
                    <div className="text-xs text-gray-500 mt-1">Carbs</div>
                  </div>
                )}
                {nutritionToDisplay?.fat && (
                  <div className="text-center">
                    <div className="text-lg font-medium">{nutritionToDisplay.fat}</div>
                    <div className="text-xs text-gray-500 mt-1">Fat</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full py-6 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 text-center">
                ChefGPT can estimate the macros per serving using the button above.
              </div>
            )}
          </div>
        )}

        <div className="pt-2 pb-4">
          <button
            onClick={onStartCooking}
            className="w-full py-4 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-sm font-medium"
          >
            <ChefHat className="w-5 h-5" />
            <span>Start Cooking</span>
          </button>
        </div>
      </div>

      {!isReviewPromptVisible && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-30"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {isAssistantOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "75vh" }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    ChefGPT <span className="text-[10px] uppercase tracking-wide text-gray-400">BETA</span>
                  </h3>
                  <p className="text-xs text-gray-500">I&apos;m your AI-powered sous chef</p>
                </div>
              </div>
              <button
                onClick={() => setIsAssistantOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-purple-500" />
                  </div>
                  <h4 className="text-sm font-medium mb-2">How can I help you today?</h4>
                  <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto">
                    Ask me anything about &quot;{recipe.title}&quot;—from prep advice to substitutions and serving tweaks. I&apos;m still in beta, so treat my answers as thoughtful guidance rather than definitive instructions.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center px-4">
                    {assistantSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setInputText(suggestion);
                          window.setTimeout(() => {
                            void handleSendMessage();
                          }, 100);
                        }}
                        disabled={isAssistantThinking}
                        className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                          isAssistantThinking
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                      message.role === "user" ? "bg-black text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              {messages.length > 0 && (
                <p className="text-[11px] text-gray-400 text-center px-4">
                  ChefGPT is powered by AI. Responses may contain mistakes—always double-check important details.
                </p>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Ask a question…"
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!inputText.trim() || isAssistantThinking}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    inputText.trim() && !isAssistantThinking
                      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-md"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    {isImageOverlayOpen && recipe.thumbnail && (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur"
          onClick={() => setIsImageOverlayOpen(false)}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsImageOverlayOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative w-full h-[70vh] bg-black">
              <NextImage
                fill
                sizes="100vw"
                src={recipe.thumbnail}
                alt={`${recipe.title} original upload`}
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function formatAddedDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";

  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

function getPlatformDisplay(source?: Recipe["source"]): string {
  switch (source) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "pinterest":
      return "Pinterest";
    case "web":
      return "Web";
    case "voice":
      return "Voice";
    case "scan":
      return "Scanned";
    default:
      return "Unknown";
  }
}
