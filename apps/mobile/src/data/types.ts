export type ImportStatus = "processing" | "ready" | "needsConnection" | "failed";
export type Platform = "tiktok" | "instagram" | "pinterest" | "youtube" | "web" | "voice" | "photo";

export interface Ingredient {
  amount: string;
  name: string;
}

export interface ImportItem {
  id: string;
  platform: Platform;
  title: string;
  thumbnail?: string;
  status: ImportStatus;
  timestamp: Date;
  url?: string;
}

export interface NutritionInfo {
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
}

export type PlanTier = "ai_disabled" | "base" | "premium";

export interface UsageSummary {
  periodStart: string;
  importCount: number;
  translationCount: number;
  optimizationCount: number;
  aiMessagesCount: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  category?: string;
  duration?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: number;
  servingsOverride?: number;
  unitSystem?: "metric" | "us";
  difficulty?: "easy" | "medium" | "hard";
  ingredients: Ingredient[];
  steps: string[];
  source: Platform;
  sourceUrl?: string;
  videoUrl?: string;
  thumbnail?: string;
  isFavorite: boolean;
  isImported?: boolean;
  isImportApproved?: boolean;
  tags?: string[];
  notes?: string;
  addedDate?: Date;
  nutrition?: NutritionInfo;
  globalRecipeId?: string;
  languageCode?: string;
}

export type Screen =
  | "welcome"
  | "home"
  | "importInbox"
  | "import"
  | "importFromLink"
  | "importFromWebsite"
  | "importFromTikTok"
  | "importFromPinterest"
  | "scanRecipe"
  | "shoppingList"
  | "myRecipes"
  | "profile"
  | "planBilling"
  | "recipeDetail"
  | "recipeEdit"
  | "cookMode"
  | "search"
  ;

export interface ShoppingListItem {
  id: string;
  name: string;
  amount?: string;
  isChecked: boolean;
  recipeId?: string;
  recipeName?: string;
}

export interface RecipeCollection {
  id: string;
  name: string;
  recipeIds: string[];
  createdAt: Date;
}

export type BottomTab = "home" | "import" | "myRecipes" | "shoppingList" | "profile";
