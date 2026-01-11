import * as ImageManipulator from "expo-image-manipulator";
import { Recipe } from "../data/types";

type BackendIngredient = {
  amount?: string | null;
  name?: string | null;
  line?: string | null;
};

type BackendInstruction = {
  text?: string | null;
  stepNumber?: number | null;
};

type BackendRecipe = {
  title?: string;
  description?: string | null;
  mealType?: string | null;
  difficulty?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  servings?: string | number | null;
  nutritionCalories?: string | number | null;
  nutritionProtein?: string | null;
  nutritionCarbs?: string | null;
  nutritionFat?: string | null;
  chefNotes?: string | null;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
  importedAt?: string | null;
  mediaVideoUrl?: string | null;
  mediaImageUrl?: string | null;
  mediaLocalPath?: string | null;
  isFavorite?: boolean | null;
  ingredients?: BackendIngredient[] | null;
  instructions?: BackendInstruction[] | null;
  tags?: string[] | null;
};

type ImportResponse = {
  recipe: BackendRecipe;
  videoPath?: string | null;
  globalRecipeId?: string | null;
  languageCode?: string | null;
  cacheHit?: boolean | null;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const API_PREFIX = `${API_BASE_URL}/api`;
let currentUserEmail: string | null = null;
let currentUserId: string | null = null;

const parseJsonResponse = async <T>(
  response: Response
): Promise<{ data: T | null; text: string }> => {
  const text = await response.text();
  if (!text) {
    return { data: null, text: "" };
  }
  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
};

const resolveMediaUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("/media/")) {
    return `${API_BASE_URL}${value}`;
  }
  const storageIndex = value.lastIndexOf("/storage/");
  if (storageIndex !== -1) {
    const relative = value.slice(storageIndex + "/storage/".length);
    return `${API_BASE_URL}/media/${relative}`;
  }
  if (value.startsWith("storage/")) {
    return `${API_BASE_URL}/media/${value.slice("storage/".length)}`;
  }
  if (value.startsWith("/storage/")) {
    return `${API_BASE_URL}/media/${value.slice("/storage/".length)}`;
  }
  return `${API_BASE_URL}/media/${value.replace(/^\//, "")}`;
};

const normalizePlatform = (platform?: string | null): Recipe["source"] => {
  const normalized = (platform || "").toLowerCase();
  if (normalized === "tiktok") return "tiktok";
  if (normalized === "pinterest") return "pinterest";
  if (normalized === "instagram") return "instagram";
  if (normalized === "youtube") return "youtube";
  if (normalized === "photo" || normalized === "scan") return "photo";
  if (normalized === "voice") return "voice";
  return "web";
};

const toNumber = (value?: string | number | null): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  const match = normalized.match(/\d+(?:[.,]\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toSteps = (instructions?: BackendInstruction[] | null): string[] => {
  if (!instructions) return [];
  return instructions
    .map((step) => (step?.text ? String(step.text).trim() : ""))
    .filter((step) => step.length > 0);
};

const toIngredients = (ingredients?: BackendIngredient[] | null): Recipe["ingredients"] => {
  if (!ingredients) return [];
  return ingredients
    .map((ingredient) => {
      const rawName = ingredient.name?.trim() || "";
      const rawLine = ingredient.line?.trim() || "";
      const baseLine = rawLine || rawName;
      if (!baseLine) return null;
      const existingAmount = ingredient.amount?.trim();
      if (existingAmount) {
        return {
          amount: existingAmount,
          name: rawName || rawLine,
        };
      }

      const parsed = splitIngredientAmount(baseLine);
      if (parsed) {
        return parsed;
      }

      return {
        amount: "",
        name: baseLine,
      };
    })
    .filter((item): item is Recipe["ingredients"][number] => Boolean(item));
};

const splitIngredientAmount = (line: string): Recipe["ingredients"][number] | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(\d+(?:[\/.,]\d+)?(?:\s+\d+\/\d+)?(?:-\d+(?:[\/.,]\d+)?)?)\s*([a-zA-Z]+\.?)?\s+(.*)$/
  );
  if (!match) {
    return null;
  }
  const amountValue = match[1]?.trim();
  const unitValue = match[2]?.trim();
  const nameValue = match[3]?.trim();
  if (!amountValue || !nameValue) {
    return null;
  }
  const amount = unitValue ? `${amountValue} ${unitValue}` : amountValue;
  return {
    amount,
    name: nameValue,
  };
};

const isHostedVideoUrl = (url?: string): boolean => {
  if (!url) return false;
  if (url.startsWith(API_BASE_URL)) return true;
  return url.includes("/media/") || url.includes("/storage/");
};

const mapImportedRecipe = (payload: ImportResponse): Recipe => {
  const recipe = payload.recipe ?? {};
  const thumbnail =
    resolveMediaUrl(recipe.mediaImageUrl) || resolveMediaUrl(recipe.mediaLocalPath);
  let videoUrl =
    resolveMediaUrl(recipe.mediaVideoUrl) || resolveMediaUrl(payload.videoPath);
  const servingsNumber = toNumber(recipe.servings);
  const ingredients = toIngredients(recipe.ingredients);
  const steps = toSteps(recipe.instructions);
  const source = normalizePlatform(recipe.sourcePlatform);

  if ((source === "tiktok" || source === "instagram") && !isHostedVideoUrl(videoUrl)) {
    videoUrl = undefined;
  }

  return {
    id: `recipe-${Date.now()}`,
    title: recipe.title?.trim() || "Imported Recipe",
    description: recipe.description || undefined,
    category: recipe.mealType || undefined,
    prepTime: recipe.prepTime || undefined,
    cookTime: recipe.cookTime || undefined,
    totalTime: recipe.totalTime || undefined,
    servings: servingsNumber,
    difficulty: recipe.difficulty as Recipe["difficulty"] | undefined,
    ingredients,
    steps,
    source,
    sourceUrl: recipe.sourceUrl || undefined,
    thumbnail,
    videoUrl,
    isFavorite: recipe.isFavorite ?? false,
    isImported: true,
    isImportApproved: false,
    tags: recipe.tags ?? [],
    notes: recipe.chefNotes || undefined,
    addedDate: recipe.importedAt ? new Date(recipe.importedAt) : undefined,
    nutrition: {
      calories: toNumber(recipe.nutritionCalories),
      protein: recipe.nutritionProtein || undefined,
      carbs: recipe.nutritionCarbs || undefined,
      fat: recipe.nutritionFat || undefined,
    },
    globalRecipeId: payload.globalRecipeId ?? undefined,
    languageCode: payload.languageCode ?? undefined,
  };
};

const postImportUrl = async (path: string, url: string): Promise<Recipe> => {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(currentUserEmail ? { "X-User-Email": currentUserEmail } : {}),
      ...(currentUserId ? { "X-User-Id": currentUserId } : {}),
    },
    body: JSON.stringify({ url }),
  });
  const { data, text } = await parseJsonResponse<ImportResponse & { detail?: string }>(response);
  if (!response.ok) {
    const detail = data?.detail?.trim();
    if (detail) {
      throw new Error(detail);
    }
    throw new Error(`Import failed (${response.status}). Please try again.`);
  }
  if (!data) {
    throw new Error("Import failed. Unexpected response from server.");
  }
  return mapImportedRecipe(data);
};

export const importFromWeb = (url: string) => postImportUrl("/import/web", url);

export const importFromTikTok = (url: string) => postImportUrl("/import/tiktok", url);

export const importFromInstagram = (url: string) => postImportUrl("/import/instagram", url);

export const importFromPinterest = (url: string) => postImportUrl("/import/pinterest", url);

export const importFromYouTube = (url: string) => postImportUrl("/import/youtube", url);

export const importFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok.com")) {
    return importFromTikTok(url);
  }
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    return importFromInstagram(url);
  }
  if (lower.includes("pinterest.com") || lower.includes("pin.it")) {
    return importFromPinterest(url);
  }
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return importFromYouTube(url);
  }
  return importFromWeb(url);
};

export const importFromScan = async (imageUris: string[]): Promise<Recipe> => {
  if (!imageUris.length) {
    throw new Error("Please select at least one image.");
  }
  const formData = new FormData();
  const files = imageUris.slice(0, 3);
  const preparedFiles = await Promise.all(
    files.map(async (uri) => {
      const nameFromUri = uri.split("/").pop()?.split("?")[0] || "scan.jpg";
      const extension = nameFromUri.split(".").pop()?.toLowerCase();
      const needsConversion = extension === "heic" || extension === "heif";
      if (needsConversion) {
        const baseName = nameFromUri.lastIndexOf(".") > 0 ? nameFromUri.slice(0, nameFromUri.lastIndexOf(".")) : nameFromUri;
        try {
          const result = await ImageManipulator.manipulateAsync(uri, [], {
            compress: 0.9,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          return { uri: result.uri, name: `${baseName || "scan"}.jpg` };
        } catch {
          return { uri, name: nameFromUri };
        }
      }
      return { uri, name: nameFromUri };
    })
  );
  for (const file of preparedFiles) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const type =
      extension === "png"
        ? "image/png"
        : extension === "heic" || extension === "heif"
        ? "image/heic"
        : "image/jpeg";
    formData.append("files", { uri: file.uri, name: file.name, type } as any);
  }

  const response = await fetch(`${API_PREFIX}/import/scan`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(currentUserEmail ? { "X-User-Email": currentUserEmail } : {}),
      ...(currentUserId ? { "X-User-Id": currentUserId } : {}),
    },
    body: formData,
  });
  const { data } = await parseJsonResponse<ImportResponse & { detail?: string }>(response);
  if (!response.ok) {
    const detail = data?.detail?.trim();
    if (detail) {
      throw new Error(detail);
    }
    throw new Error(`Scan failed (${response.status}). Please try again.`);
  }
  if (!data) {
    throw new Error("Scan failed. Unexpected response from server.");
  }
  return mapImportedRecipe(data);
};

export const setImportUserEmail = (email: string | null) => {
  currentUserEmail = email?.trim() ? email.trim() : null;
};

export const setImportUserId = (userId: string | null) => {
  currentUserId = userId?.trim() ? userId.trim() : null;
};
