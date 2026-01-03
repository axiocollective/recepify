import { supabase } from "./supabaseClient";
import { Ingredient, PlanTier, Recipe, RecipeCollection, ShoppingListItem, UsageSummary } from "../data/types";

let currentUserId: string | null = null;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => uuidRegex.test(value);

const createUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

const isRemoteUrl = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

const uploadToBucket = async (uri: string, bucket: string, recipeId: string, kind: string) => {
  if (!uri || isRemoteUrl(uri)) return uri;
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const fileName = `${kind}-${Date.now()}.${extension}`;
  const path = `${recipeId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type || undefined,
  });
  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

const mapRecipeRow = (
  row: any,
  ingredients: Array<{ recipe_id: string; name: string; amount: string; position: number }> = [],
  steps: Array<{ recipe_id: string; text: string; step_number: number }> = [],
  likedIds: Set<string> = new Set()
): Recipe => {
  const recipeIngredients = ingredients
    .filter((item) => item.recipe_id === row.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item) => ({ amount: item.amount ?? "", name: item.name ?? "" }));

  const recipeSteps = steps
    .filter((item) => item.recipe_id === row.id)
    .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))
    .map((item) => item.text ?? "");

  const source = row.source_platform ?? "web";

  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    category: row.meal_type ?? undefined,
    prepTime: row.prep_time ?? undefined,
    cookTime: row.cook_time ?? undefined,
    totalTime: row.total_time ?? undefined,
    duration: row.total_time ?? row.prep_time ?? row.cook_time ?? undefined,
    servings: row.servings ?? undefined,
    difficulty: row.difficulty ?? undefined,
    ingredients: recipeIngredients,
    steps: recipeSteps,
    source,
    sourceUrl: row.source_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    thumbnail: row.image_url ?? undefined,
    isFavorite: likedIds.has(row.id),
    tags: row.tags ?? [],
    notes: row.notes ?? undefined,
    addedDate: row.created_at ? new Date(row.created_at) : undefined,
    isImported: row.is_imported ?? false,
    isImportApproved: row.is_import_approved ?? false,
    nutrition: {
      calories: row.nutrition_calories ?? undefined,
      protein: row.nutrition_protein ?? undefined,
      carbs: row.nutrition_carbs ?? undefined,
      fat: row.nutrition_fat ?? undefined,
    },
  };
};

export const ensureProfile = async (payload: { name?: string; language?: string; country?: string; aiDisabled?: boolean; plan?: PlanTier; subscriptionPeriod?: "monthly" | "yearly" }) => {
  if (!currentUserId) return;
  const updatePayload: Record<string, string | boolean | PlanTier | null> = { id: currentUserId };
  if (payload.name !== undefined) updatePayload.name = payload.name ?? null;
  if (payload.language !== undefined) updatePayload.language = payload.language ?? null;
  if (payload.country !== undefined) updatePayload.country = payload.country ?? null;
  if (payload.aiDisabled !== undefined) updatePayload.ai_disabled = payload.aiDisabled ?? null;
  if (payload.plan !== undefined) updatePayload.plan = payload.plan ?? null;
  if (payload.subscriptionPeriod !== undefined) updatePayload.subscription_period = payload.subscriptionPeriod ?? null;

  const { error } = await supabase.from("profiles").upsert(updatePayload);
  if (error) throw error;
};

export const fetchProfile = async () => {
  if (!currentUserId) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", currentUserId).single();
  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
};

export const addPayPerUseCredits = async (payload: { imports: number; tokens: number }) => {
  if (!currentUserId) return { bonusImports: 0, bonusTokens: 0 };
  const { data, error } = await supabase
    .from("profiles")
    .select("bonus_imports, bonus_tokens")
    .eq("id", currentUserId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  const currentImports = data?.bonus_imports ?? 0;
  const currentTokens = data?.bonus_tokens ?? 0;
  const nextImports = currentImports + payload.imports;
  const nextTokens = currentTokens + payload.tokens;
  const { error: updateError } = await supabase.from("profiles").upsert({
    id: currentUserId,
    bonus_imports: nextImports,
    bonus_tokens: nextTokens,
  });
  if (updateError) throw updateError;
  return { bonusImports: nextImports, bonusTokens: nextTokens };
};

export const fetchUsageSummary = async (): Promise<UsageSummary | null> => {
  if (!currentUserId) return null;
  const { data, error } = await supabase
    .from("usage_monthly")
    .select("period_start, import_count, ai_tokens")
    .eq("owner_id", currentUserId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return {
    periodStart: data.period_start,
    importCount: data.import_count ?? 0,
    aiTokens: data.ai_tokens ?? 0,
  };
};

export const fetchRecipes = async (): Promise<Recipe[]> => {
  if (!currentUserId) return [];
  const { data: recipeRows, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("owner_id", currentUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!recipeRows?.length) return [];

  const recipeIds = recipeRows.map((row) => row.id);

  const [{ data: ingredientRows }, { data: stepRows }, { data: likeRows }] = await Promise.all([
    supabase.from("recipe_ingredients").select("*").in("recipe_id", recipeIds),
    supabase.from("recipe_steps").select("*").in("recipe_id", recipeIds),
    supabase.from("recipe_likes").select("recipe_id").eq("owner_id", currentUserId),
  ]);

  const likedIds = new Set((likeRows ?? []).map((row) => row.recipe_id));

  return recipeRows.map((row) => mapRecipeRow(row, ingredientRows ?? [], stepRows ?? [], likedIds));
};

export const saveRecipe = async (recipe: Recipe): Promise<Recipe> => {
  if (!currentUserId) {
    throw new Error("User is not authenticated.");
  }
  const recipeId = isUuid(recipe.id) ? recipe.id : createUuid();
  const imageUrl = recipe.thumbnail
    ? await uploadToBucket(recipe.thumbnail, "recipe-images", recipeId, "image")
    : undefined;
  const videoUrl = recipe.videoUrl
    ? await uploadToBucket(recipe.videoUrl, "recipe-videos", recipeId, "video")
    : undefined;

  const { error: recipeError } = await supabase.from("recipes").upsert({
    id: recipeId,
    owner_id: currentUserId,
    title: recipe.title,
    description: recipe.description ?? null,
    servings: recipe.servings ?? null,
    notes: recipe.notes ?? null,
    nutrition_calories: recipe.nutrition?.calories ?? null,
    nutrition_protein: recipe.nutrition?.protein ?? null,
    nutrition_carbs: recipe.nutrition?.carbs ?? null,
    nutrition_fat: recipe.nutrition?.fat ?? null,
    source_url: recipe.sourceUrl ?? null,
    source_platform: recipe.source ?? null,
    video_url: videoUrl ?? recipe.videoUrl ?? null,
    image_url: imageUrl ?? recipe.thumbnail ?? null,
    tags: recipe.tags ?? [],
    is_imported: recipe.isImported ?? false,
    is_import_approved: recipe.isImportApproved ?? false,
    raw_import_data: (recipe as any).rawImportData ?? null,
    prep_time: recipe.prepTime ?? null,
    cook_time: recipe.cookTime ?? null,
    total_time: recipe.totalTime ?? null,
    meal_type: recipe.category ?? null,
    difficulty: recipe.difficulty ?? null,
  });
  if (recipeError) throw recipeError;

  await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  await supabase.from("recipe_steps").delete().eq("recipe_id", recipeId);

  if (recipe.ingredients.length > 0) {
    const ingredientsPayload = recipe.ingredients.map((ingredient, index) => ({
      recipe_id: recipeId,
      name: ingredient.name,
      amount: ingredient.amount ?? null,
      position: index,
    }));
    const { error } = await supabase.from("recipe_ingredients").insert(ingredientsPayload);
    if (error) throw error;
  }

  if (recipe.steps.length > 0) {
    const stepsPayload = recipe.steps.map((step, index) => ({
      recipe_id: recipeId,
      text: step,
      step_number: index + 1,
    }));
    const { error } = await supabase.from("recipe_steps").insert(stepsPayload);
    if (error) throw error;
  }

  if (recipe.isFavorite) {
    await supabase.from("recipe_likes").upsert({ owner_id: currentUserId, recipe_id: recipeId });
  } else {
    await supabase.from("recipe_likes").delete().eq("owner_id", currentUserId).eq("recipe_id", recipeId);
  }

  return { ...recipe, id: recipeId, thumbnail: imageUrl ?? recipe.thumbnail, videoUrl: videoUrl ?? recipe.videoUrl };
};

export const deleteRecipe = async (recipeId: string) => {
  await supabase.from("recipes").delete().eq("id", recipeId);
};

export const setRecipeLike = async (recipeId: string, isFavorite: boolean) => {
  if (!currentUserId) return;
  if (isFavorite) {
    await supabase.from("recipe_likes").upsert({ owner_id: currentUserId, recipe_id: recipeId });
  } else {
    await supabase.from("recipe_likes").delete().eq("owner_id", currentUserId).eq("recipe_id", recipeId);
  }
};

export const fetchShoppingListItems = async (): Promise<ShoppingListItem[]> => {
  if (!currentUserId) return [];
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("owner_id", currentUserId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? "",
    amount: row.amount ?? "",
    isChecked: row.is_checked ?? false,
    recipeId: row.recipe_id ?? undefined,
  }));
};

export const fetchRecipeCollections = async (): Promise<RecipeCollection[]> => {
  if (!currentUserId) return [];
  const { data: collectionRows, error } = await supabase
    .from("recipe_collections")
    .select("*")
    .eq("owner_id", currentUserId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!collectionRows?.length) return [];

  const collectionIds = collectionRows.map((row) => row.id);
  const { data: itemRows, error: itemError } = await supabase
    .from("recipe_collection_items")
    .select("*")
    .in("collection_id", collectionIds);
  if (itemError) throw itemError;

  const itemMap = new Map<string, string[]>();
  (itemRows ?? []).forEach((row) => {
    const list = itemMap.get(row.collection_id) ?? [];
    list.push(row.recipe_id);
    itemMap.set(row.collection_id, list);
  });

  return collectionRows.map((row) => ({
    id: row.id,
    name: row.name ?? "",
    recipeIds: itemMap.get(row.id) ?? [],
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  }));
};

export const addShoppingListItems = async (
  ingredients: Ingredient[],
  recipeName: string,
  recipeId: string
): Promise<ShoppingListItem[]> => {
  if (!currentUserId) return [];
  const items = ingredients.map((ingredient) => ({
    id: createUuid(),
    name: ingredient.name,
    amount: ingredient.amount ?? "",
    isChecked: false,
    recipeId,
    recipeName,
  }));

  const payload = items.map((item) => ({
    id: item.id,
    owner_id: currentUserId,
    recipe_id: item.recipeId ?? null,
    name: item.name,
    amount: item.amount ?? null,
    is_checked: item.isChecked,
  }));

  const { error } = await supabase.from("shopping_list_items").insert(payload);
  if (error) throw error;

  return items;
};

export const replaceShoppingListItems = async (items: ShoppingListItem[]) => {
  if (!currentUserId) return;
  await supabase.from("shopping_list_items").delete().eq("owner_id", currentUserId);

  if (items.length === 0) return;
  const payload = items.map((item) => ({
    id: isUuid(item.id) ? item.id : createUuid(),
    owner_id: currentUserId,
    recipe_id: item.recipeId ?? null,
    name: item.name,
    amount: item.amount ?? null,
    is_checked: item.isChecked,
  }));
  const { error } = await supabase.from("shopping_list_items").insert(payload);
  if (error) throw error;
};

export const replaceRecipeCollections = async (collections: RecipeCollection[]) => {
  if (!currentUserId) return;
  const { data: existingCollections, error: existingError } = await supabase
    .from("recipe_collections")
    .select("id")
    .eq("owner_id", currentUserId);
  if (existingError) throw existingError;
  const existingIds = (existingCollections ?? []).map((row) => row.id);

  if (existingIds.length) {
    const { error: deleteItemsError } = await supabase
      .from("recipe_collection_items")
      .delete()
      .in("collection_id", existingIds);
    if (deleteItemsError) throw deleteItemsError;

    const { error: deleteCollectionsError } = await supabase
      .from("recipe_collections")
      .delete()
      .eq("owner_id", currentUserId);
    if (deleteCollectionsError) throw deleteCollectionsError;
  }

  if (collections.length === 0) return;

  const normalizedCollections = collections.map((collection) => ({
    id: isUuid(collection.id) ? collection.id : createUuid(),
    owner_id: currentUserId,
    name: collection.name,
    created_at: collection.createdAt ?? new Date(),
  }));
  const { error: insertCollectionsError } = await supabase
    .from("recipe_collections")
    .insert(normalizedCollections);
  if (insertCollectionsError) throw insertCollectionsError;

  const itemsPayload = normalizedCollections.flatMap((collection, index) =>
    collections[index].recipeIds.map((recipeId) => ({
      id: createUuid(),
      collection_id: collection.id,
      recipe_id: recipeId,
      created_at: new Date(),
    }))
  );
  if (itemsPayload.length === 0) return;
  const { error: insertItemsError } = await supabase.from("recipe_collection_items").insert(itemsPayload);
  if (insertItemsError) throw insertItemsError;
};

export const setSupabaseUserId = (userId: string | null) => {
  currentUserId = userId;
};
