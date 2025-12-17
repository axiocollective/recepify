import type {
  RecipeAssistantRequestPayload,
  RecipeAssistantResponsePayload,
  RecipeFinderRequestPayload,
  RecipeFinderResponsePayload,
} from "@/types/assistant";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const textPayload = await response.text();
  if (!textPayload) {
    return undefined as T;
  }

  return JSON.parse(textPayload) as T;
}

export interface ApiIngredientInput {
  line: string;
  amount?: string | null;
  name?: string | null;
}

export interface ApiInstructionInput {
  stepNumber?: number | null;
  text: string;
}

export interface ImportedRecipePayload {
  title: string;
  description?: string | null;
  mealType?: string | null;
  difficulty?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  servings?: string | null;
  nutritionCalories?: string | null;
  nutritionProtein?: string | null;
  nutritionCarbs?: string | null;
  nutritionFat?: string | null;
  chefNotes?: string | null;
  sourcePlatform: string;
  sourceUrl: string;
  sourceDomain?: string | null;
  importedAt?: string | null;
  mediaVideoUrl?: string | null;
  mediaImageUrl?: string | null;
  mediaLocalPath?: string | null;
  isFavorite?: boolean;
  tags?: string[];
  ingredients: ApiIngredientInput[];
  instructions: ApiInstructionInput[];
}

export interface ImportResponsePayload {
  recipe: ImportedRecipePayload;
  videoPath?: string | null;
}

export interface RecipeReadPayload extends ImportedRecipePayload {
  id: string;
  ingredients: (ApiIngredientInput & { id: string })[];
  instructions: (ApiInstructionInput & { id: string; stepNumber: number })[];
  tags: string[];
  importedAt: string;
}

export type UnitPreference = "metric" | "us";

export interface UserSettingsPayload {
  userId: string;
  country: string | null;
  unitPreference: UnitPreference;
  languagePreference: "en" | "de";
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettingsUpdatePayload {
  country?: string | null;
  unitPreference?: UnitPreference;
  languagePreference?: "en" | "de";
  notificationsEnabled?: boolean;
}

export async function fetchRecipes(): Promise<RecipeReadPayload[]> {
  return request<RecipeReadPayload[]>("/api/recipes");
}

export async function createRecipe(payload: ImportedRecipePayload): Promise<RecipeReadPayload> {
  return request<RecipeReadPayload>("/api/recipes", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      tags: payload.tags ?? [],
      ingredients: payload.ingredients ?? [],
      instructions: payload.instructions ?? [],
      isFavorite: payload.isFavorite ?? false,
    }),
  });
}

export async function updateRecipe(
  recipeId: string,
  payload: ImportedRecipePayload
): Promise<RecipeReadPayload> {
  return request<RecipeReadPayload>(`/api/recipes/${recipeId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      tags: payload.tags ?? [],
      ingredients: payload.ingredients ?? [],
      instructions: payload.instructions ?? [],
      isFavorite: payload.isFavorite ?? false,
    }),
  });
}

export async function importFromWeb(url: string): Promise<ImportResponsePayload> {
  return request<ImportResponsePayload>("/api/import/web", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function importFromTikTok(url: string): Promise<ImportResponsePayload> {
  return request<ImportResponsePayload>("/api/import/tiktok", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function importFromInstagram(url: string): Promise<ImportResponsePayload> {
  return request<ImportResponsePayload>("/api/import/instagram", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function importFromPinterest(url: string): Promise<ImportResponsePayload> {
  return request<ImportResponsePayload>("/api/import/pinterest", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function importFromScan(file: File): Promise<ImportResponsePayload> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/import/scan`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }

  return (await response.json()) as ImportResponsePayload;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await request<void>(`/api/recipes/${recipeId}`, { method: "DELETE" });
}

export async function askRecipeAssistant(
  payload: RecipeAssistantRequestPayload
): Promise<RecipeAssistantResponsePayload> {
  return request<RecipeAssistantResponsePayload>("/api/assistant/recipe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function askRecipeFinder(
  payload: RecipeFinderRequestPayload
): Promise<RecipeFinderResponsePayload> {
  const apiPayload = {
    query: payload.query,
    recipes: payload.recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      tags: recipe.tags ?? [],
      prep_time: recipe.prepTime,
      cook_time: recipe.cookTime,
      total_time: recipe.totalTime,
      category: recipe.category,
      ingredients: recipe.ingredients ?? [],
      steps: recipe.steps ?? [],
      notes: recipe.notes ?? undefined,
      nutrition_calories: recipe.nutritionCalories ?? undefined,
      nutrition_protein: recipe.nutritionProtein ?? undefined,
      nutrition_carbs: recipe.nutritionCarbs ?? undefined,
      nutrition_fat: recipe.nutritionFat ?? undefined,
      is_favorite: recipe.isFavorite ?? false,
    })),
  };

  return request<RecipeFinderResponsePayload>("/api/assistant/finder", {
    method: "POST",
    body: JSON.stringify(apiPayload),
  });
}

export async function getUserSettings(): Promise<UserSettingsPayload> {
  return request<UserSettingsPayload>("/api/users/me/settings");
}

export async function updateUserSettings(
  payload: UserSettingsUpdatePayload
): Promise<UserSettingsPayload> {
  return request<UserSettingsPayload>("/api/users/me/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export interface ShoppingListItemPayload {
  id: string;
  name: string;
  amount?: string | null;
  isChecked: boolean;
  recipeId?: string | null;
  recipeName?: string | null;
}

interface ShoppingListSyncPayload {
  items: ShoppingListItemPayload[];
}

export async function fetchShoppingListItems(): Promise<ShoppingListItemPayload[]> {
  return request<ShoppingListItemPayload[]>("/api/shopping-list");
}

export async function saveShoppingListItems(
  items: ShoppingListItemPayload[]
): Promise<ShoppingListItemPayload[]> {
  return request<ShoppingListItemPayload[]>("/api/shopping-list", {
    method: "PUT",
    body: JSON.stringify({ items } satisfies ShoppingListSyncPayload),
  });
}
