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
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const API_PREFIX = `${API_BASE_URL}/api`;
let currentUserEmail: string | null = null;
let currentUserId: string | null = null;

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
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
  if (normalized === "photo" || normalized === "scan") return "photo";
  if (normalized === "voice") return "voice";
  return "web";
};

const toNumber = (value?: string | number | null): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
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

const mapImportedRecipe = (payload: ImportResponse): Recipe => {
  const recipe = payload.recipe ?? {};
  const thumbnail =
    resolveMediaUrl(recipe.mediaImageUrl) || resolveMediaUrl(recipe.mediaLocalPath);
  const videoUrl =
    resolveMediaUrl(recipe.mediaVideoUrl) || resolveMediaUrl(payload.videoPath);
  const servingsNumber = toNumber(recipe.servings);

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
    ingredients: toIngredients(recipe.ingredients),
    steps: toSteps(recipe.instructions),
    source: normalizePlatform(recipe.sourcePlatform),
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
  const data = await parseJsonResponse<ImportResponse & { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(data.detail || "Import failed.");
  }
  return mapImportedRecipe(data);
};

export const importFromWeb = (url: string) => postImportUrl("/import/web", url);

export const importFromTikTok = (url: string) => postImportUrl("/import/tiktok", url);

export const importFromPinterest = (url: string) => postImportUrl("/import/pinterest", url);

export const importFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok.com")) {
    return importFromTikTok(url);
  }
  if (lower.includes("pinterest.com") || lower.includes("pin.it")) {
    return importFromPinterest(url);
  }
  return importFromWeb(url);
};

export const importFromScan = async (imageUri: string): Promise<Recipe> => {
  const imageResponse = await fetch(imageUri);
  if (!imageResponse.ok) {
    throw new Error("Unable to load the image for scanning.");
  }
  const blob = await imageResponse.blob();
  const nameFromUri = imageUri.split("/").pop()?.split("?")[0] || "scan.jpg";

  const formData = new FormData();
  formData.append("file", blob, nameFromUri);

  const response = await fetch(`${API_PREFIX}/import/scan`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(currentUserEmail ? { "X-User-Email": currentUserEmail } : {}),
      ...(currentUserId ? { "X-User-Id": currentUserId } : {}),
    },
    body: formData,
  });
  const data = await parseJsonResponse<ImportResponse & { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(data.detail || "Scan failed.");
  }
  return mapImportedRecipe(data);
};

export const setImportUserEmail = (email: string | null) => {
  currentUserEmail = email?.trim() ? email.trim() : null;
};

export const setImportUserId = (userId: string | null) => {
  currentUserId = userId?.trim() ? userId.trim() : null;
};
