'use client';

import { useEffect, useMemo, useState, useCallback } from "react";
import { BottomNav } from "@/components/figma/BottomNav";
import { CookMode } from "@/components/figma/CookMode";
import { Home } from "@/components/figma/Home";
import { ImportFromPinterest } from "@/components/figma/ImportFromPinterest";
import { ImportFromTikTok } from "@/components/figma/ImportFromTikTok";
import { ImportFromWebsite } from "@/components/figma/ImportFromWebsite";
import { ScanRecipe } from "@/components/figma/ScanRecipe";
import { ImportFromInstagram } from "@/components/figma/ImportFromInstagram";
import { ImportHub } from "@/components/figma/ImportHub";
import { ImportInbox } from "@/components/figma/ImportInbox";
import { MyRecipes } from "@/components/figma/MyRecipes";
import { Profile } from "@/components/figma/Profile";
import { LoginScreen } from "@/components/figma/LoginScreen";
import { RecipeDetail } from "@/components/figma/RecipeDetail";
import { RecipeEdit } from "@/components/figma/RecipeEdit";
import { RecordVoiceRecipe } from "@/components/figma/RecordVoiceRecipe";
import { ShoppingList } from "@/components/figma/ShoppingList";
import { figmaRecipes } from "@/lib/figma-data";
import type {
  ImportItem,
  Recipe,
  RecipeDifficulty,
  RecipeSource,
  Screen,
  ShoppingListItem,
} from "@/types/figma";
import type { Recipe as ApiRecipe } from "@/types/recipe";
import { formatDuration, splitIngredientLine, formatIngredientText } from "@/lib/utils";
import {
  fetchRecipes,
  fetchShoppingListItems,
  saveShoppingListItems,
  createRecipe,
  deleteRecipe as deleteRecipeApi,
  updateRecipe as updateRecipeApi,
  importFromWeb as importWebService,
  importFromTikTok as importTikTokService,
  importFromInstagram as importInstagramService,
  importFromPinterest as importPinterestService,
  type ImportedRecipePayload,
  type ImportResponsePayload,
  type RecipeReadPayload,
  type ShoppingListItemPayload,
} from "@/lib/api";

type AppTab = "home" | "import" | "myRecipes" | "shoppingList" | "profile";

const tabToScreen: Record<AppTab, Screen> = {
  home: "home",
  import: "import",
  myRecipes: "myRecipes",
  shoppingList: "shoppingList",
  profile: "profile"
};

const screenToTab: Partial<Record<Screen, AppTab>> = {
  home: "home",
  import: "import",
  myRecipes: "myRecipes",
  shoppingList: "shoppingList",
  profile: "profile"
};

const platformThumbnails: Record<string, string> = {
  tiktok: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=60",
  instagram: "https://images.unsplash.com/photo-1475090169767-40ed8d18f67d?auto=format&fit=crop&w=400&q=60",
  pinterest: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=400&q=60",
  web: "https://images.unsplash.com/photo-1475090169767-485b36e66b6f?auto=format&fit=crop&w=400&q=60",
  default: "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=400&q=60"
};

const initialImportStage = {
  progress: 12,
  message: "Submitting link..."
};

const importProgressStages = [
  { delay: 700, progress: 35, message: "Fetching recipe..." },
  { delay: 1500, progress: 60, message: "Extracting ingredients..." },
  { delay: 2300, progress: 82, message: "Cleaning steps..." }
];

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const toNumber = (value?: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

const buildMediaUrl = (raw?: string | null): string | undefined => {
  if (!raw) {
    return undefined;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const normalized = raw.replace(/\\/g, "/");
  const storageIndex = normalized.lastIndexOf("storage/");
  const relative = storageIndex >= 0 ? normalized.slice(storageIndex + "storage/".length) : normalized;
  return `${API_BASE_URL}/media/${relative.replace(/^\/+/, "")}`;
};

const parseMinutesFromDuration = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*m/);
  const colonMatch = normalized.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const hours = Number.parseInt(colonMatch[1], 10);
    const minutes = Number.parseInt(colonMatch[2], 10);
    return hours * 60 + minutes;
  }
  const totalMinutes = (Number(hourMatch?.[1]?.replace(",", ".")) || 0) * 60 +
    (Number(minuteMatch?.[1]?.replace(",", ".")) || 0);
  if (totalMinutes > 0) {
    return Math.round(totalMinutes);
  }
  const plainMinutes = normalized.match(/(\d+)\s*min/);
  if (plainMinutes) {
    return Number.parseInt(plainMinutes[1], 10);
  }
  const numeric = Number.parseInt(normalized, 10);
  return Number.isNaN(numeric) ? undefined : numeric;
};

type ApiRecipeWithFavorite = (ApiRecipe | RecipeReadPayload) & { isFavorite?: boolean };

const hasIsFavoriteFlag = (recipe: ApiRecipe | RecipeReadPayload): recipe is ApiRecipeWithFavorite =>
  typeof recipe === "object" && recipe !== null && "isFavorite" in recipe;

const mapApiRecipeToFigma = (apiRecipe: ApiRecipe | RecipeReadPayload): Recipe => {
  const ingredients = apiRecipe.ingredients
    .map((ingredient, index) => {
      const split = splitIngredientLine(ingredient.line ?? undefined);
      return {
        id: ingredient.id ?? `${apiRecipe.id}-ing-${index}`,
        line: ingredient.line ?? ingredient.name ?? undefined,
        amount: ingredient.amount ?? split.amount ?? undefined,
        name: ingredient.name ?? split.name ?? ingredient.line ?? undefined,
      };
    })
    .filter((ingredient) =>
      Boolean(
        ingredient.amount?.trim() || ingredient.name?.trim() || ingredient.line?.trim()?.length
      )
    );

  const steps = [...apiRecipe.instructions]
    .sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0))
    .map((step) => step.text)
    .filter((text) => Boolean(text.length));

  const calories = toNumber(apiRecipe.nutritionCalories);
  const servings = toNumber(apiRecipe.servings);
  const hasNutritionData = [
    apiRecipe.nutritionCalories,
    apiRecipe.nutritionProtein,
    apiRecipe.nutritionCarbs,
    apiRecipe.nutritionFat,
  ].some((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    return String(value).trim().length > 0;
  });
  const nutrition = hasNutritionData
    ? {
        calories: calories ?? undefined,
        protein: apiRecipe.nutritionProtein ?? undefined,
        carbs: apiRecipe.nutritionCarbs ?? undefined,
        fat: apiRecipe.nutritionFat ?? undefined,
      }
    : undefined;

  const normalizedSource = (apiRecipe.sourcePlatform ?? "").toLowerCase();
  const validSources: RecipeSource[] = ["tiktok", "instagram", "pinterest", "web", "voice", "scan"];
  const source = validSources.includes(normalizedSource as RecipeSource)
    ? (normalizedSource as RecipeSource)
    : undefined;
  const isScannedRecipe = source === "scan";
  const friendlyPrepTime = formatDuration(apiRecipe.prepTime ?? undefined);
  const friendlyCookTime = formatDuration(apiRecipe.cookTime ?? undefined);
  const friendlyTotalTime = formatDuration(apiRecipe.totalTime ?? undefined);
  const videoUrl = isScannedRecipe
    ? undefined
    : buildMediaUrl(apiRecipe.mediaVideoUrl ?? apiRecipe.mediaLocalPath ?? undefined);
  const thumbnailUrl =
    buildMediaUrl(apiRecipe.mediaImageUrl ?? undefined) ?? apiRecipe.mediaImageUrl ?? undefined;
  const candidateMinutes =
    parseMinutesFromDuration(apiRecipe.totalTime) ??
    parseMinutesFromDuration(apiRecipe.cookTime) ??
    parseMinutesFromDuration(apiRecipe.prepTime);
  let speedTag: string | undefined;
  if (typeof candidateMinutes === "number") {
    if (candidateMinutes <= 30) {
      speedTag = "quick (<30 min)";
    } else if (candidateMinutes <= 60) {
      speedTag = "medium (30-60 min)";
    } else {
      speedTag = undefined;
    }
  }
  const sanitizedTags = (apiRecipe.tags ?? [])
    .map((tag) => (tag ?? "").trim().toLowerCase())
    .filter((tag) => tag.length > 0 && !tag.startsWith("#"));
  const normalizedSpeedTag = (speedTag ?? "").toLowerCase().trim();
  const tags = normalizedSpeedTag && !sanitizedTags.includes(normalizedSpeedTag)
    ? [...sanitizedTags, normalizedSpeedTag]
    : sanitizedTags;

  return {
    id: apiRecipe.id,
    title: apiRecipe.title,
    description: apiRecipe.description ?? undefined,
    thumbnail: thumbnailUrl,
    videoUrl,
    prepTime: friendlyPrepTime,
    cookTime: friendlyCookTime,
    totalTime: friendlyTotalTime,
    duration: friendlyTotalTime ?? friendlyCookTime ?? friendlyPrepTime ?? undefined,
    servings,
    difficulty: (apiRecipe.difficulty ?? undefined) as RecipeDifficulty | undefined,
    category: apiRecipe.mealType ?? undefined,
    source,
    tags,
    ingredients,
    steps,
    notes: apiRecipe.chefNotes ?? undefined,
    nutrition,
    sourceUrl: apiRecipe.sourceUrl ?? undefined,
    sourceDomain: apiRecipe.sourceDomain ?? undefined,
    importedAt: apiRecipe.importedAt ?? new Date().toISOString(),
    isFavorite: hasIsFavoriteFlag(apiRecipe) ? Boolean(apiRecipe.isFavorite) : false,
  };
};

const mapFigmaRecipeToApiPayload = (recipe: Recipe): ImportedRecipePayload => {
  const sanitizeString = (value?: string | null) => (value?.trim() ? value : null);
  const normalizedSource = recipe.source ?? "web";
  const safeTags = (recipe.tags ?? [])
    .map((tag) => (tag ?? "").trim().toLowerCase())
    .filter((tag): tag is string => Boolean(tag));

  return {
    title: recipe.title || "Untitled Recipe",
    description: sanitizeString(recipe.description ?? null),
    mealType: sanitizeString(recipe.category ?? null),
    difficulty: recipe.difficulty ?? null,
    prepTime: sanitizeString(recipe.prepTime ?? null),
    cookTime: sanitizeString(recipe.cookTime ?? null),
    totalTime: sanitizeString(recipe.totalTime ?? null),
    servings: recipe.servings ? String(recipe.servings) : null,
    nutritionCalories: recipe.nutrition?.calories ? String(recipe.nutrition.calories) : null,
    nutritionProtein: recipe.nutrition?.protein ?? null,
    nutritionCarbs: recipe.nutrition?.carbs ?? null,
    nutritionFat: recipe.nutrition?.fat ?? null,
    chefNotes: sanitizeString(recipe.notes ?? null),
    sourcePlatform: normalizedSource,
    sourceUrl:
      recipe.sourceUrl ??
      (normalizedSource === "scan" ? "scan://local" : `recipefy://recipe/${recipe.id}`),
    sourceDomain: recipe.sourceDomain ?? null,
    importedAt: recipe.importedAt ?? new Date().toISOString(),
    mediaVideoUrl: recipe.videoUrl ?? null,
    mediaImageUrl: recipe.thumbnail ?? null,
    mediaLocalPath: null,
    tags: safeTags,
    ingredients: recipe.ingredients.map((ingredient) => ({
      line: ingredient.line?.trim() || formatIngredientText(ingredient),
      amount: ingredient.amount ?? null,
      name: ingredient.name ?? null,
    })),
    instructions: (recipe.steps ?? []).map((text, index) => ({
      stepNumber: index + 1,
      text,
    })),
    isFavorite: recipe.isFavorite ?? false,
  };
};

const mapApiShoppingListItem = (item: ShoppingListItemPayload): ShoppingListItem => ({
  id: item.id,
  name: item.name,
  amount: item.amount ?? undefined,
  isChecked: Boolean(item.isChecked),
  recipeId: item.recipeId ?? undefined,
  recipeName: item.recipeName ?? undefined,
});

const serializeShoppingListItems = (items: ShoppingListItem[]): ShoppingListItemPayload[] =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    amount: item.amount ?? null,
    isChecked: item.isChecked,
    recipeId: item.recipeId ?? null,
    recipeName: item.recipeName ?? null,
  }));

const createDraftRecipe = (title: string, source: Recipe["source"], description?: string): Recipe => ({
  id: generateId(),
  title: title || "New Recipe",
  description,
  source,
  ingredients: [],
  steps: [],
  tags: [],
  importedAt: new Date().toISOString(),
  isFavorite: false,
});

export function FigmaExperience() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [screen, setScreen] = useState<Screen>("home");
  const [detailReturnScreen, setDetailReturnScreen] = useState<Screen>("home");
  const [editReturnScreen, setEditReturnScreen] = useState<Screen>("recipeDetail");
  const [recipes, setRecipes] = useState<Recipe[]>(() => [...figmaRecipes]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(figmaRecipes[0] ?? null);
  const [myRecipesTagFilter, setMyRecipesTagFilter] = useState<string | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [cookModeRecipe, setCookModeRecipe] = useState<Recipe | null>(null);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [toolReturnScreen, setToolReturnScreen] = useState<Screen>("home");
  const [inboxReturnScreen, setInboxReturnScreen] = useState<Screen>("home");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const clearMyRecipesTagFilter = useCallback(() => {
    setMyRecipesTagFilter(null);
  }, []);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [reviewRecipeId, setReviewRecipeId] = useState<string | null>(null);
  const persistIdentity = useCallback((nextName: string, nextEmail: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("recepify:userName", nextName);
    window.localStorage.setItem("recepify:userEmail", nextEmail);
  }, []);
  const clearIdentity = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem("recepify:userName");
    window.localStorage.removeItem("recepify:userEmail");
  }, []);
  const persistShoppingListItems = useCallback((items: ShoppingListItem[]) => {
    saveShoppingListItems(serializeShoppingListItems(items)).catch((error) => {
      console.error("Failed to save shopping list items", error);
    });
  }, []);
  const replaceShoppingListItems = useCallback(
    (items: ShoppingListItem[]) => {
      setShoppingListItems(items);
      persistShoppingListItems(items);
    },
    [persistShoppingListItems]
  );
  const updateShoppingListItemsState = useCallback(
    (updater: (prev: ShoppingListItem[]) => ShoppingListItem[]) => {
      setShoppingListItems((prev) => {
        const next = updater(prev);
        persistShoppingListItems(next);
        return next;
      });
    },
    [persistShoppingListItems]
  );

  const handleNameChange = (value: string) => {
    setUserName(value);
    if (isAuthenticated) {
      persistIdentity(value, userEmail);
    }
  };

  const handleEmailChange = (value: string) => {
    setUserEmail(value);
    if (isAuthenticated) {
      persistIdentity(userName || "", value);
    }
  };

  const handleLogin = ({ name, email }: { name: string; email: string }) => {
    setUserName(name);
    setUserEmail(email);
    setIsAuthenticated(true);
    persistIdentity(name, email);
    setActiveTab("profile");
    setScreen("profile");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserName("");
    setUserEmail("");
    setShoppingListItems([]);
    setSelectedRecipe(null);
    clearIdentity();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedName = window.localStorage.getItem("recepify:userName");
    const storedEmail = window.localStorage.getItem("recepify:userEmail");
    if (storedName && storedEmail) {
      setUserName(storedName);
      setUserEmail(storedEmail);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let isMounted = true;
    const loadRecipes = async () => {
      setIsLoadingRecipes(true);
      try {
        const apiRecipes = await fetchRecipes();
        if (!isMounted) {
          return;
        }
        if (apiRecipes.length) {
          const mapped = apiRecipes.map(mapApiRecipeToFigma);
          setRecipes(mapped);
          setSelectedRecipe(mapped[0] ?? null);
        }
      } catch (error) {
        console.error("Failed to load recipes", error);
        if (isMounted) {
          setLoadError("Unable to load recipes from the backend.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecipes(false);
        }
      }
    };

    loadRecipes();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let isMounted = true;
    const loadShoppingList = async () => {
      try {
        const apiItems = await fetchShoppingListItems();
        if (!isMounted) {
          return;
        }
        setShoppingListItems(apiItems.map(mapApiShoppingListItem));
      } catch (error) {
        console.error("Failed to load shopping list items", error);
      }
    };
    loadShoppingList();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const startImportJob = (platform: ImportItem["platform"], label: string) => {
    const job: ImportItem = {
      id: generateId(),
      title: label,
      platform,
      status: "processing",
      timestamp: new Date(),
      thumbnail: platformThumbnails[platform] ?? platformThumbnails.default,
      progress: initialImportStage.progress,
      progressMessage: initialImportStage.message,
    };
    setImportItems((prev) => [job, ...prev]);
    return job.id;
  };

  const updateImportJob = (jobId: string, patch: Partial<ImportItem>) => {
    setImportItems((prev) =>
      prev.map((item) => (item.id === jobId ? { ...item, ...patch } : item))
    );
  };

  const animateImportProgress = (jobId: string) => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    importProgressStages.forEach((stage) => {
      const timer = setTimeout(() => {
        if (cancelled) {
          return;
        }
        updateImportJob(jobId, {
          progress: stage.progress,
          progressMessage: stage.message,
        });
      }, stage.delay);
      timers.push(timer);
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  };

  const persistImportedRecipe = async (payload: ImportedRecipePayload) => {
    const normalizedPayload: ImportedRecipePayload = {
      ...payload,
      tags: payload.tags ?? [],
      ingredients: payload.ingredients ?? [],
      instructions: payload.instructions ?? [],
      importedAt: payload.importedAt ?? new Date().toISOString(),
    };
    const savedRecipe = await createRecipe(normalizedPayload);
    const mappedRecipe = mapApiRecipeToFigma(savedRecipe);

    setRecipes((prev) => [mappedRecipe, ...prev]);
    setSelectedRecipe(mappedRecipe);
    setDetailReturnScreen("home");
    goToScreen("recipeDetail");
    setReviewRecipeId(mappedRecipe.id);

    return { savedRecipe, mappedRecipe };
  };

  const convertImportedPayloadToDraft = (payload: ImportedRecipePayload): Recipe => {
    const syntheticId = generateId();
    const normalizedSource = (payload.sourcePlatform ?? "").toLowerCase();
    const validSources: RecipeSource[] = ["tiktok", "instagram", "pinterest", "web", "voice", "scan"];
    const source = validSources.includes(normalizedSource as RecipeSource)
      ? (normalizedSource as RecipeSource)
      : undefined;
    const apiRecipe: ApiRecipe = {
      id: syntheticId,
      title: payload.title || "Scanned Recipe",
      description: payload.description ?? null,
      mealType: payload.mealType ?? null,
      difficulty: payload.difficulty ?? null,
      prepTime: payload.prepTime ?? null,
      cookTime: payload.cookTime ?? null,
      totalTime: payload.totalTime ?? null,
      servings: payload.servings ?? null,
      nutritionCalories: payload.nutritionCalories ?? null,
      nutritionProtein: payload.nutritionProtein ?? null,
      nutritionCarbs: payload.nutritionCarbs ?? null,
      nutritionFat: payload.nutritionFat ?? null,
      tags: payload.tags ?? [],
      chefNotes: payload.chefNotes ?? null,
      sourcePlatform: source ?? "scan",
      sourceUrl: payload.sourceUrl ?? "scan://local",
      sourceDomain: payload.sourceDomain ?? null,
      importedAt: payload.importedAt ?? new Date().toISOString(),
      mediaVideoUrl: payload.mediaVideoUrl ?? null,
      mediaImageUrl: payload.mediaImageUrl ?? null,
      mediaLocalPath: payload.mediaLocalPath ?? null,
      ingredients: (payload.ingredients ?? []).map((ingredient, index) => ({
        id: `${syntheticId}-ing-${index}`,
        line: ingredient.line ?? "",
        amount: ingredient.amount ?? null,
        name: ingredient.name ?? null,
      })),
      instructions: (payload.instructions ?? []).map((instruction, index) => ({
        id: `${syntheticId}-step-${index}`,
        stepNumber: instruction.stepNumber ?? index + 1,
        text: instruction.text ?? "",
      })),
    };
    return mapApiRecipeToFigma(apiRecipe);
  };

  const runImportFlow = async (
    platform: ImportItem["platform"],
    url: string,
    importer: (url: string) => Promise<ImportResponsePayload>
  ) => {
    const jobId = startImportJob(platform, url);
    const stopProgressAnimation = animateImportProgress(jobId);
    try {
      const response = await importer(url);
      const { savedRecipe } = await persistImportedRecipe(response.recipe);
      stopProgressAnimation();
      updateImportJob(jobId, {
        status: "ready",
        title: savedRecipe.title,
        thumbnail: savedRecipe.mediaImageUrl ?? undefined,
        recipeId: savedRecipe.id,
        timestamp: new Date(savedRecipe.importedAt ?? Date.now()),
        progress: 100,
        progressMessage: "Recipe ready",
      });
    } catch (error) {
      stopProgressAnimation();
      updateImportJob(jobId, { status: "failed", progressMessage: "Import failed" });
      throw error;
    }
  };

  const applyRecipeUpdateToState = (updatedRecipe: Recipe) => {
    setRecipes((prev) =>
      prev.some((recipe) => recipe.id === updatedRecipe.id)
        ? prev.map((recipe) => (recipe.id === updatedRecipe.id ? updatedRecipe : recipe))
        : [updatedRecipe, ...prev]
    );
    if (selectedRecipe?.id === updatedRecipe.id) {
      setSelectedRecipe(updatedRecipe);
    }
    if (editingRecipe?.id === updatedRecipe.id) {
      setEditingRecipe(updatedRecipe);
    }
  };

  const persistRecipeUpdate = async (recipeToSave: Recipe): Promise<Recipe> => {
    const payload = mapFigmaRecipeToApiPayload(recipeToSave);
    const savedRecipe = await updateRecipeApi(recipeToSave.id, payload);
    const mappedRecipe = mapApiRecipeToFigma(savedRecipe);
    applyRecipeUpdateToState(mappedRecipe);
    return mappedRecipe;
  };

  const handleUpdateRecipeTags = async (recipe: Recipe, nextTags: string[]) => {
    const uniqueTags: string[] = [];
    const seen = new Set<string>();
    nextTags.forEach((tag) => {
      const trimmed = (tag ?? "").trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      uniqueTags.push(key);
    });
    await persistRecipeUpdate({ ...recipe, tags: uniqueTags });
  };

  const handleWebImport = (url: string) => runImportFlow("web", url, importWebService);
  const handleTikTokImport = (url: string) => runImportFlow("tiktok", url, importTikTokService);
  const handleInstagramImport = (url: string) =>
    runImportFlow("instagram", url, importInstagramService);
  const handlePinterestImport = (url: string) =>
    runImportFlow("pinterest", url, importPinterestService);
  const handleLinkImport = (url: string, source: "tiktok" | "instagram" | "pinterest" | "web") => {
    switch (source) {
      case "tiktok":
        return handleTikTokImport(url);
      case "instagram":
        return handleInstagramImport(url);
      case "pinterest":
        return handlePinterestImport(url);
      default:
        return handleWebImport(url);
    }
  };

  const importQueueCount = useMemo(
    () => importItems.filter((item) => item.status !== "ready").length,
    [importItems]
  );

  const goToScreen = (next: Screen) => {
    setScreen(next);
    const tab = screenToTab[next];
    if (tab) {
      setActiveTab(tab);
    }
  };

  const handleNavigate = (next: Screen) => {
    if (next === "recordVoiceRecipe" || next === "scanRecipe") {
      setToolReturnScreen(screen);
    }
    if (next === "importInbox") {
      setInboxReturnScreen(screen);
    }
    if (next === "myRecipes") {
      setMyRecipesTagFilter(null);
    }
    goToScreen(next);
  };

  const handleTabChange = (tab: AppTab) => {
    goToScreen(tabToScreen[tab]);
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    setDetailReturnScreen(screen);
    setSelectedRecipe(recipe);
    goToScreen("recipeDetail");
  };

  const handleRecipeEdit = (recipe: Recipe, returnTo: Screen = "recipeDetail") => {
    setEditReturnScreen(returnTo);
    setEditingRecipe(recipe);
    setSelectedRecipe(recipe);
    goToScreen("recipeEdit");
  };

  const handleRecipeSave = (updatedRecipe: Recipe) => {
    let existed = false;
    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === updatedRecipe.id);
      existed = exists;
      if (exists) {
        return prev.map((r) => (r.id === updatedRecipe.id ? updatedRecipe : r));
      }
      return [updatedRecipe, ...prev];
    });
    if (!existed) {
      setReviewRecipeId(updatedRecipe.id);
    }

    setSelectedRecipe(updatedRecipe);
    setEditingRecipe(updatedRecipe);

    if (editReturnScreen !== "recipeDetail") {
      setDetailReturnScreen(editReturnScreen);
    }

    goToScreen("recipeDetail");
  };

  const handleToggleFavorite = async (recipe?: Recipe) => {
    const target = recipe ?? selectedRecipe;
    if (!target) return;
    const updated = { ...target, isFavorite: !target.isFavorite };
    setRecipes((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    if (!recipe || selectedRecipe?.id === updated.id) {
      setSelectedRecipe(updated);
    }
    try {
      await persistRecipeUpdate(updated);
    } catch (error) {
      console.error("Failed to update favorite status", error);
    }
  };

  const handleRecipeDelete = async (recipeId: string) => {
    try {
      await deleteRecipeApi(recipeId);
      setRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
      setReviewRecipeId((prev) => (prev === recipeId ? null : prev));
      if (selectedRecipe?.id === recipeId) {
        setSelectedRecipe(null);
        goToScreen("home");
      }
    } catch (error) {
      console.error("Failed to delete recipe", error);
      throw error;
    }
  };

  const handleAddIngredientsToShoppingList = (
    items: { name: string; amount?: string }[],
    sourceRecipe: Recipe
  ) => {
    if (!items.length) {
      return;
    }
    updateShoppingListItemsState((prev) => [
      ...prev,
      ...items.map((item) => ({
        id: generateId(),
        name: item.name,
        amount: item.amount,
        isChecked: false,
        recipeId: sourceRecipe.id,
        recipeName: sourceRecipe.title,
      })),
    ]);
  };

  const handleStartCooking = () => {
    if (!selectedRecipe) return;
    setCookModeRecipe(selectedRecipe);
  };

  const handleImportAction = (itemId: string, action: "open" | "connect" | "retry" | "delete") => {
    const targetItem = importItems.find((item) => item.id === itemId);

    if (action === "open") {
      if (targetItem?.recipeId) {
        const recipe = recipes.find((entry) => entry.id === targetItem.recipeId);
        if (recipe) {
          handleRecipeSelect(recipe);
          return;
        }
      }
      if (selectedRecipe) {
        handleRecipeSelect(selectedRecipe);
      }
      return;
    }

    if (action === "delete") {
      setImportItems((prev) => prev.filter((item) => item.id !== itemId));
      return;
    }

    if (action === "retry" || action === "connect") {
      setImportItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: "processing", timestamp: new Date() } : item
        )
      );
    }

  };

  const handleVoiceSave = (transcription: string) => {
    const firstLine = transcription.split(/\n|\./)[0]?.trim() ?? "Voice Recipe";
    const draft = createDraftRecipe(firstLine, "voice", transcription);
    setRecipes((prev) => [draft, ...prev]);
    handleRecipeEdit(draft, toolReturnScreen);
  };

  const handleScanImport = (recipe: ImportedRecipePayload) => {
    const draft = convertImportedPayloadToDraft(recipe);
    handleRecipeEdit(draft, toolReturnScreen);
  };

  const startManualRecipe = (returnTo: Screen) => {
  const draft = {
      ...createDraftRecipe("", "web"),
      title: "",
      description: "",
      ingredients: [{ id: generateId(), line: "", amount: "", name: "" }],
      steps: [""],
    };
    handleRecipeEdit(draft, returnTo);
  };

  const renderScreen = () => {
    switch (screen) {
      case "home":
      return (
        <Home
          onNavigate={handleNavigate}
          importQueueCount={importQueueCount}
          recentRecipes={recipes.slice(0, 3)}
          onRecipeSelect={handleRecipeSelect}
          allRecipes={recipes}
          onAddManual={() => startManualRecipe("home")}
          userName={userName}
          onQuickFilter={(tag) => {
            setMyRecipesTagFilter(tag);
            goToScreen("myRecipes");
          }}
          inboxCount={importItems.filter((item) => item.status === "ready").length}
        />
      );
      case "import":
        return (
          <ImportHub
            onNavigate={handleNavigate}
            onAddManually={() => startManualRecipe("import")}
            sharedRecipesCount={importItems.filter((item) => item.status === "ready").length}
          />
        );
      case "importFromLink":
        return (
          <ImportFromWebsite
            onBack={() => goToScreen("import")}
            onImport={handleLinkImport}
          />
        );
      case "scanRecipe":
        return (
          <ScanRecipe
            onBack={() => goToScreen("import")}
            onScanComplete={handleScanImport}
          />
        );
      case "importFromTikTok":
        return (
          <ImportFromTikTok
            onBack={() => goToScreen("import")}
            onImport={handleTikTokImport}
          />
        );
      case "importFromInstagram":
        return (
          <ImportFromInstagram
            onBack={() => goToScreen("import")}
            onImport={handleInstagramImport}
          />
        );
      case "importFromPinterest":
        return (
          <ImportFromPinterest
            onBack={() => goToScreen("import")}
            onImport={handlePinterestImport}
          />
        );
      case "recordVoiceRecipe":
        return (
          <RecordVoiceRecipe
            onBack={() => goToScreen(toolReturnScreen)}
            onSave={handleVoiceSave}
          />
        );
      case "importInbox":
        return (
          <ImportInbox
            items={importItems}
            onBack={() => goToScreen(inboxReturnScreen)}
            onAction={handleImportAction}
          />
        );
      case "myRecipes":
        return (
          <MyRecipes
            recipes={recipes}
            onRecipeSelect={handleRecipeSelect}
            onRecipeEdit={(recipe) => handleRecipeEdit(recipe, "myRecipes")}
            onRecipeDelete={(recipe) => handleRecipeDelete(recipe.id)}
            onRecipeToggleFavorite={handleToggleFavorite}
            initialTag={myRecipesTagFilter}
            onClearInitialTag={clearMyRecipesTagFilter}
          />
        );
      case "shoppingList":
        return (
          <ShoppingList
            items={shoppingListItems}
            onUpdateItems={replaceShoppingListItems}
            onBack={() => goToScreen("home")}
          />
        );
      case "profile":
        return (
          <Profile
            name={userName}
            email={userEmail}
            onNameChange={handleNameChange}
            onEmailChange={handleEmailChange}
            onLogout={handleLogout}
          />
        );
      case "recipeDetail":
        return (
          selectedRecipe && (
            <RecipeDetail
              recipe={selectedRecipe}
              onBack={() => goToScreen(detailReturnScreen)}
              onStartCooking={handleStartCooking}
              onToggleFavorite={() => handleToggleFavorite()}
              onEdit={() => handleRecipeEdit(selectedRecipe)}
              onDelete={() => handleRecipeDelete(selectedRecipe.id)}
              onAddIngredientsToShoppingList={(items) =>
                handleAddIngredientsToShoppingList(items, selectedRecipe)
              }
              onUpdateTags={handleUpdateRecipeTags}
              showReviewPrompt={reviewRecipeId === selectedRecipe.id}
              onDismissReviewPrompt={() => setReviewRecipeId(null)}
            />
          )
        );
      case "recipeEdit":
        return (
          <RecipeEdit
            recipe={editingRecipe || selectedRecipe || recipes[0]}
            onBack={() => goToScreen(editReturnScreen)}
            onSave={handleRecipeSave}
          />
        );
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen onSubmit={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto min-h-screen max-w-md bg-white shadow-lg">
        {isLoadingRecipes && (
          <div className="px-4 py-2 text-center text-xs text-muted-foreground">Loading recipes…</div>
        )}
        {loadError && (
          <div className="px-4 py-2 text-sm text-red-600">{loadError}</div>
        )}
        {renderScreen()}
        <BottomNav selected={activeTab} onSelect={handleTabChange} importBadgeCount={importQueueCount} />
        {cookModeRecipe && (
          <CookMode
            recipe={cookModeRecipe}
            onExit={() => setCookModeRecipe(null)}
          />
        )}
      </div>
    </div>
  );
}
