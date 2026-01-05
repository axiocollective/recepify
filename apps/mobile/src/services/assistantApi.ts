const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
let currentUserEmail: string | null = null;
let currentUserId: string | null = null;

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantRecipe = {
  title: string;
  description?: string;
  duration?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  difficulty?: string;
  meal_type?: string;
  source?: string;
  nutrition_calories?: string;
  nutrition_protein?: string;
  nutrition_carbs?: string;
  nutrition_fat?: string;
  tags?: string[];
  notes?: string;
  ingredients?: string[];
  steps?: string[];
};

type RecipeAssistantRequest = {
  recipe: AssistantRecipe;
  messages: AssistantMessage[];
  structured?: boolean;
  usage_context?: string;
};

type RecipeAssistantResponse = {
  reply: string;
};

export const askRecipeAssistant = async (
  payload: RecipeAssistantRequest
): Promise<RecipeAssistantResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/assistant/recipe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(currentUserEmail ? { "X-User-Email": currentUserEmail } : {}),
      ...(currentUserId ? { "X-User-Id": currentUserId } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }

  const textPayload = await response.text();
  if (!textPayload) {
    return { reply: "" };
  }

  return JSON.parse(textPayload) as RecipeAssistantResponse;
};

export const setAssistantUserEmail = (email: string | null) => {
  currentUserEmail = email?.trim() ? email.trim() : null;
};

export const setAssistantUserId = (userId: string | null) => {
  currentUserId = userId?.trim() ? userId.trim() : null;
};
