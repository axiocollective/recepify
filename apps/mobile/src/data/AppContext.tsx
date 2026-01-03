import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { sampleImportItems } from "./mockData";
import { BottomTab, ImportItem, Ingredient, PlanTier, Recipe, RecipeCollection, Screen, ShoppingListItem, UsageSummary } from "./types";
import {
  addShoppingListItems,
  addPayPerUseCredits,
  deleteRecipe as deleteRecipeRemote,
  ensureProfile,
  fetchProfile,
  fetchRecipeCollections,
  fetchRecipes,
  fetchShoppingListItems,
  fetchUsageSummary,
  replaceRecipeCollections,
  replaceShoppingListItems,
  saveRecipe,
  setRecipeLike,
  setSupabaseUserId,
} from "../services/supabaseData";
import { deleteUserAccount } from "../services/accountApi";
import { supabase } from "../services/supabaseClient";
import { setAssistantUserEmail, setAssistantUserId } from "../services/assistantApi";
import { importFromUrl, setImportUserEmail, setImportUserId } from "../services/importApi";

interface AppContextValue {
  isAuthenticated: boolean;
  currentScreen: Screen;
  selectedRecipe: Recipe | null;
  selectedTab: BottomTab;
  isImportOverlayOpen: boolean;
  importItems: ImportItem[];
  recipes: Recipe[];
  collections: RecipeCollection[];
  shoppingListItems: ShoppingListItem[];
  connectedAccounts: Record<string, boolean>;
  userName: string;
  userEmail: string;
  userLanguage: "English" | "German";
  userCountry: string;
  needsOnboarding: boolean;
  profileReady: boolean;
  aiDisabled: boolean;
  plan: PlanTier;
  usageSummary: UsageSummary | null;
  bonusImports: number;
  bonusTokens: number;
  subscriptionPeriod: "monthly" | "yearly";
  simulateEmptyState: boolean;
  setIsImportOverlayOpen: (open: boolean) => void;
  setSelectedRecipe: (recipe: Recipe | null) => void;
  setCurrentScreen: (screen: Screen) => void;
  setSelectedTab: (tab: BottomTab) => void;
  handleLoadingComplete: (payload?: { name?: string; email?: string }) => void;
  updateProfile: (payload: {
    name?: string;
    email?: string;
    language?: "English" | "German";
    country?: string;
    aiDisabled?: boolean;
    plan?: PlanTier;
    subscriptionPeriod?: "monthly" | "yearly";
  }) => void;
  deleteAccount: () => Promise<void>;
  logout: () => void;
  navigateTo: (screen: Screen) => void;
  handleRecipeSelect: (recipe: Recipe) => void;
  toggleFavorite: (recipeId: string) => void;
  handleImportAction: (itemId: string, action: "open" | "connect" | "retry" | "delete") => void;
  handleAddToShoppingList: (ingredients: Ingredient[], recipeName: string, recipeId: string) => void;
  updateShoppingListItems: (items: ShoppingListItem[]) => void;
  createCollection: (name: string, recipeId?: string) => void;
  toggleRecipeInCollection: (recipeId: string, collectionId: string) => void;
  deleteCollection: (collectionId: string) => void;
  updateRecipe: (recipe: Recipe) => void;
  addRecipe: (recipe: Recipe) => Promise<Recipe | null>;
  deleteRecipe: (recipeId: string) => void;
  updateAccountConnection: (platform: string, connected: boolean) => void;
  refreshUsageSummary: () => void;
  purchasePayPerUseCredits: () => Promise<void>;
  setSimulateEmptyState: (value: boolean) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedTab, setSelectedTab] = useState<BottomTab>("home");
  const [isImportOverlayOpen, setIsImportOverlayOpen] = useState(false);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState({
    tiktok: true,
    instagram: true,
    pinterest: false,
  });
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userLanguage, setUserLanguage] = useState<"English" | "German">("English");
  const [userCountry, setUserCountry] = useState("United States");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  const [plan, setPlan] = useState<PlanTier>("free");
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [bonusImports, setBonusImports] = useState(0);
  const [bonusTokens, setBonusTokens] = useState(0);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<"monthly" | "yearly">("yearly");
  const [userId, setUserId] = useState<string | null>(null);
  const [simulateEmptyState, setSimulateEmptyState] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  const createUuid = useCallback(
    () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      }),
    []
  );

  const extractSharedUrl = useCallback((incoming?: string | null) => {
    if (!incoming) return null;
    const trimmed = incoming.trim();
    if (!trimmed) return null;

    try {
      const parsed = new URL(trimmed);
      const sharedParam = parsed.searchParams.get("url") || parsed.searchParams.get("link");
      if (sharedParam) {
        const candidate = sharedParam.trim();
        if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
          return candidate;
        }
        if (candidate.startsWith("www.")) {
          return `https://${candidate}`;
        }
        if (candidate.includes(".")) {
          return `https://${candidate}`;
        }
        return candidate;
      }
    } catch (error) {
      // Fall through to heuristic checks below.
    }

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }

    if (trimmed.startsWith("www.")) {
      return `https://${trimmed}`;
    }

    if (trimmed.includes(".")) {
      return `https://${trimmed}`;
    }

    return null;
  }, []);

  const getPlatformFromUrl = useCallback((url: string): ImportItem["platform"] => {
    const lower = url.toLowerCase();
    if (lower.includes("tiktok.com") || lower.includes("vm.tiktok.com")) {
      return "tiktok";
    }
    if (lower.includes("pinterest.com") || lower.includes("pin.it")) {
      return "pinterest";
    }
    if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
      return "instagram";
    }
    return "web";
  }, []);

  const getImportTitle = useCallback((url: string, platform: ImportItem["platform"]) => {
    if (platform === "tiktok") {
      return "TikTok recipe link";
    }
    if (platform === "pinterest") {
      return "Pinterest pin";
    }
    if (platform === "instagram") {
      return "Instagram recipe link";
    }

    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname ? `Shared from ${hostname}` : "Shared recipe link";
    } catch (error) {
      return "Shared recipe link";
    }
  }, []);

  const fetchOpenGraphData = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const html = await response.text();
      const ogTitleMatch = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/name=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const ogImageMatch = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/name=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/property=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      const ogTitle = ogTitleMatch?.[1]?.trim();
      const ogImageRaw = ogImageMatch?.[1]?.trim();
      const ogImage = ogImageRaw ? new URL(ogImageRaw, url).toString() : undefined;
      return { ogTitle, ogImage };
    } catch (error) {
      return null;
    }
  }, []);

  const addImportItemFromUrl = useCallback(
    (url: string) => {
      let didAdd = false;
      const id = createUuid();
      const platform = getPlatformFromUrl(url);
      const status =
        platform === "pinterest" && !connectedAccounts.pinterest ? "needsConnection" : "ready";
      const title = getImportTitle(url, platform);
      setImportItems((prev) => {
        if (prev.some((item) => item.url === url)) {
          return prev;
        }
        const nextItem: ImportItem = {
          id,
          platform,
          title,
          status,
          timestamp: new Date(),
          url,
        };
        didAdd = true;
        return [nextItem, ...prev];
      });
      if (didAdd) {
        setCurrentScreen("importInbox");
        setSelectedTab("import");
        if (platform === "web") {
          void fetchOpenGraphData(url).then((data) => {
            if (!data) return;
            setImportItems((prev) =>
              prev.map((item) => {
                if (item.id !== id) return item;
                return {
                  ...item,
                  title: data.ogTitle?.trim() || item.title,
                  thumbnail: data.ogImage || item.thumbnail,
                };
              })
            );
          });
        }
      }
      return didAdd;
    },
    [
      connectedAccounts.pinterest,
      createUuid,
      fetchOpenGraphData,
      getImportTitle,
      getPlatformFromUrl,
    ]
  );

  const refreshData = useCallback(async () => {
    try {
      const [profile, loadedRecipes, loadedShopping, loadedCollections, loadedUsage] = await Promise.all([
        fetchProfile(),
        fetchRecipes(),
        fetchShoppingListItems(),
        fetchRecipeCollections(),
        fetchUsageSummary(),
      ]);
      if (profile) {
        setUserName(profile.name ?? "");
        setUserLanguage(profile.language === "German" ? "German" : "English");
        setUserCountry(profile.country ?? "United States");
        setNeedsOnboarding(!profile.language || !profile.country);
        const nextAiDisabled = Boolean(profile.ai_disabled);
        const nextPlan = (profile.plan as PlanTier | null) ?? (nextAiDisabled ? "ai_disabled" : "free");
        setAiDisabled(nextPlan === "ai_disabled" ? true : nextAiDisabled);
        setPlan(nextPlan);
        setBonusImports(profile.bonus_imports ?? 0);
        setBonusTokens(profile.bonus_tokens ?? 0);
        setSubscriptionPeriod(profile.subscription_period === "monthly" ? "monthly" : "yearly");
      } else {
        setNeedsOnboarding(true);
      }
      setRecipes(loadedRecipes);
      setShoppingListItems(loadedShopping);
      setCollections(loadedCollections);
      setUsageSummary(loadedUsage);
    } catch (error) {
      console.warn("Failed to load Supabase data", error);
    } finally {
      setProfileReady(true);
    }
  }, []);

  const refreshUsageSummary = useCallback(() => {
    void fetchUsageSummary()
      .then((summary) => setUsageSummary(summary))
      .catch((error) => {
        console.warn("Failed to load usage summary", error);
      });
  }, []);

  const purchasePayPerUseCredits = useCallback(async () => {
    try {
      const next = await addPayPerUseCredits({ imports: 15, tokens: 75000 });
      setBonusImports(next.bonusImports);
      setBonusTokens(next.bonusTokens);
      Alert.alert("Credits added", "15 recipe imports and 75k AI tokens were added to your account.");
    } catch (error) {
      console.warn("Failed to add pay per use credits", error);
      Alert.alert("Purchase failed", "Please try again in a moment.");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
    const session = data.session;
    const nextUserId = session?.user?.id ?? null;
    setUserId(nextUserId);
    setSupabaseUserId(nextUserId);
    setIsAuthenticated(Boolean(session));
    setUserEmail(session?.user?.email ?? "");
    setAssistantUserEmail(session?.user?.email ?? "");
    setImportUserEmail(session?.user?.email ?? "");
    setAssistantUserId(session?.user?.id ?? null);
    setImportUserId(session?.user?.id ?? null);
    if (nextUserId && nextUserId !== lastUserIdRef.current) {
      setImportItems([]);
    }
    lastUserIdRef.current = nextUserId;
    if (session) {
      void refreshData();
    }
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user?.id ?? null;
    setUserId(nextUserId);
    setSupabaseUserId(nextUserId);
    setIsAuthenticated(Boolean(session));
    setUserEmail(session?.user?.email ?? "");
    setAssistantUserEmail(session?.user?.email ?? "");
    setImportUserEmail(session?.user?.email ?? "");
    setAssistantUserId(session?.user?.id ?? null);
    setImportUserId(session?.user?.id ?? null);
    if (nextUserId && nextUserId !== lastUserIdRef.current) {
      setImportItems([]);
    }
    lastUserIdRef.current = nextUserId;
    if (session) {
      void refreshData();
    }
    });

    return () => {
      isMounted = false;
      authSubscription?.subscription?.unsubscribe();
    };
  }, [refreshData]);

  useEffect(() => {
    const handleSharedLink = (incoming?: string | null) => {
      const sharedUrl = extractSharedUrl(incoming);
      if (sharedUrl) {
        const didAdd = addImportItemFromUrl(sharedUrl);
        if (didAdd) {
          Alert.alert("Saved to inbox", "This link was added to your import inbox.");
        }
      }
    };

    void Linking.getInitialURL().then(handleSharedLink).catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleSharedLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [addImportItemFromUrl, extractSharedUrl]);

  useEffect(() => {
    let isActive = true;
    const handleClipboard = async () => {
      try {
        const value = await Clipboard.getStringAsync();
        if (!isActive || !value) return;
        if (!value.startsWith("recepify-share:")) return;
        const url = value.replace("recepify-share:", "").trim();
        if (!url) return;
        const didAdd = addImportItemFromUrl(url);
        if (didAdd) {
          await Clipboard.setStringAsync("");
        }
      } catch (error) {
        // Ignore clipboard errors.
      }
    };

    void handleClipboard();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void handleClipboard();
      }
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [addImportItemFromUrl]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const channel = supabase
      .channel("recipefy-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipes", filter: `owner_id=eq.${userId}` },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_ingredients" },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_steps" },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_likes", filter: `owner_id=eq.${userId}` },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_list_items", filter: `owner_id=eq.${userId}` },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_collections", filter: `owner_id=eq.${userId}` },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_collection_items" },
        () => refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => refreshData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, refreshData, userId]);

  const handleLoadingComplete = useCallback((payload?: { name?: string; email?: string }) => {
    setCurrentScreen("home");
    setSelectedTab("home");
    const hasProfileName = payload?.name !== undefined;
    if (hasProfileName) {
      setUserName(payload.name ?? "");
    }
    if (payload?.email) {
      setUserEmail(payload.email);
    }
    if (hasProfileName) {
      void ensureProfile({
        name: payload?.name ?? "",
        language: userLanguage,
        country: userCountry,
        aiDisabled,
        plan,
        subscriptionPeriod,
      });
    }
  }, [aiDisabled, plan, subscriptionPeriod, userCountry, userLanguage]);

  const updateProfile = useCallback((payload: { name?: string; email?: string; language?: "English" | "German"; country?: string; aiDisabled?: boolean; plan?: PlanTier; subscriptionPeriod?: "monthly" | "yearly" }) => {
    const nextName = payload.name ?? userName;
    const nextLanguage = payload.language ?? userLanguage;
    const nextCountry = payload.country ?? userCountry;
    const nextPlan = payload.plan ?? plan;
    const nextSubscriptionPeriod = payload.subscriptionPeriod ?? subscriptionPeriod;
    const nextAiDisabled =
      payload.plan !== undefined ? payload.plan === "ai_disabled" : payload.aiDisabled ?? aiDisabled;

    if (payload.name !== undefined) {
      setUserName(payload.name);
    }
    if (payload.email !== undefined) {
      setUserEmail(payload.email);
    }
    if (payload.language !== undefined) {
      setUserLanguage(payload.language);
    }
    if (payload.country !== undefined) {
      setUserCountry(payload.country);
    }
    if (payload.language !== undefined || payload.country !== undefined) {
      setNeedsOnboarding(!(nextLanguage && nextCountry));
    }
    if (payload.aiDisabled !== undefined) {
      setAiDisabled(payload.aiDisabled);
    }
    if (payload.plan !== undefined) {
      setPlan(payload.plan);
      setAiDisabled(payload.plan === "ai_disabled");
    }
    if (payload.subscriptionPeriod !== undefined) {
      setSubscriptionPeriod(payload.subscriptionPeriod);
    }

    void ensureProfile({
      name: nextName,
      language: nextLanguage,
      country: nextCountry,
      aiDisabled: nextAiDisabled,
      plan: nextPlan,
      subscriptionPeriod: nextSubscriptionPeriod,
    });
  }, [aiDisabled, plan, subscriptionPeriod, userCountry, userLanguage, userName]);

  const deleteAccount = useCallback(async () => {
    if (!userId) {
      throw new Error("User is not authenticated.");
    }
    await deleteUserAccount(userId);
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentScreen("welcome");
    setSelectedTab("home");
    setCollections([]);
    setRecipes([]);
    setShoppingListItems([]);
    setImportItems([]);
    setSelectedRecipe(null);
    setUserName("");
    setUserEmail("");
    setUserLanguage("English");
    setUserCountry("United States");
    setNeedsOnboarding(true);
    setProfileReady(false);
    setAiDisabled(false);
    setPlan("free");
    setBonusImports(0);
    setBonusTokens(0);
    setUsageSummary(null);
  }, [userId]);

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentScreen("welcome");
    setSelectedTab("home");
    setCollections([]);
    setProfileReady(false);
    setBonusImports(0);
    setBonusTokens(0);
  }, []);

  const navigateTo = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
    if (screen === "home" || screen === "import" || screen === "myRecipes" || screen === "shoppingList" || screen === "profile") {
      setSelectedTab(screen);
    }
  }, []);

  const handleRecipeSelect = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setCurrentScreen("recipeDetail");
  }, []);

  const toggleFavorite = useCallback((recipeId: string) => {
    const next = recipes.find((recipe) => recipe.id === recipeId);
    const nextFavorite = next ? !next.isFavorite : false;
    setRecipes((prev) =>
      prev.map((recipe) => (recipe.id === recipeId ? { ...recipe, isFavorite: nextFavorite } : recipe))
    );
    setSelectedRecipe((prev) => (prev?.id === recipeId ? { ...prev, isFavorite: nextFavorite } : prev));
    if (next) {
      void setRecipeLike(recipeId, nextFavorite);
    }
  }, [recipes]);

  const handleImportAction = useCallback(
    (itemId: string, action: "open" | "connect" | "retry" | "delete") => {
      const item = importItems.find((importItem) => importItem.id === itemId);
      if (!item) return;

      if (action === "open") {
        const recipe = recipes.find((recipeItem) => recipeItem.sourceUrl === item.url);
        if (recipe) {
          handleRecipeSelect(recipe);
          return;
        }
        if (!item.url) {
          return;
        }
        setImportItems((prev) =>
          prev.map((importItem) =>
            importItem.id === itemId ? { ...importItem, status: "processing" } : importItem
          )
        );
        void importFromUrl(item.url)
          .then(async (imported) => {
            const saved = await addRecipe(imported);
            const nextRecipe = saved ?? imported;
            setSelectedRecipe(nextRecipe);
            setCurrentScreen("recipeEdit");
            refreshUsageSummary();
            setImportItems((prev) => prev.filter((importItem) => importItem.id !== itemId));
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
            Alert.alert("Import failed", message);
            setImportItems((prev) =>
              prev.map((importItem) =>
                importItem.id === itemId ? { ...importItem, status: "failed" } : importItem
              )
            );
          });
        return;
      }

      if (action === "delete") {
        setImportItems((prev) => prev.filter((importItem) => importItem.id !== itemId));
        return;
      }

      if (action === "connect") {
        setConnectedAccounts((prev) => ({ ...prev, [item.platform]: true }));
      }

      setImportItems((prev) =>
        prev.map((importItem) =>
          importItem.id === itemId ? { ...importItem, status: "processing" } : importItem
        )
      );

      setTimeout(() => {
        setImportItems((prev) =>
          prev.map((importItem) =>
            importItem.id === itemId ? { ...importItem, status: "ready" } : importItem
          )
        );
      }, 2000);
    },
    [handleRecipeSelect, importItems, recipes, refreshUsageSummary]
  );

  const handleAddToShoppingList = useCallback(
    (ingredients: Ingredient[], recipeName: string, recipeId: string) => {
      void addShoppingListItems(ingredients, recipeName, recipeId)
        .then((newItems) => {
          setShoppingListItems((prev) => [...prev, ...newItems]);
        })
        .catch((error) => {
          console.warn("Failed to add shopping list items", error);
        });
    },
    []
  );

  const updateShoppingListItems = useCallback((items: ShoppingListItem[]) => {
    setShoppingListItems(items);
    void replaceShoppingListItems(items).catch((error) => {
      console.warn("Failed to save shopping list", error);
    });
  }, []);

  const updateCollections = useCallback((nextCollections: RecipeCollection[]) => {
    setCollections(nextCollections);
    void replaceRecipeCollections(nextCollections).catch((error) => {
      console.warn("Failed to save collections", error);
    });
  }, []);

  const createCollection = useCallback(
    (name: string, recipeId?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newCollection: RecipeCollection = {
        id: createUuid(),
        name: trimmed,
        recipeIds: recipeId ? [recipeId] : [],
        createdAt: new Date(),
      };
      updateCollections([...collections, newCollection]);
    },
    [collections, updateCollections]
  );

  const toggleRecipeInCollection = useCallback(
    (recipeId: string, collectionId: string) => {
      updateCollections(
        collections.map((collection) => {
          if (collection.id !== collectionId) {
            return collection;
          }
          const isInCollection = collection.recipeIds.includes(recipeId);
          return {
            ...collection,
            recipeIds: isInCollection
              ? collection.recipeIds.filter((id) => id !== recipeId)
              : [...collection.recipeIds, recipeId],
          };
        })
      );
    },
    [collections, updateCollections]
  );

  const deleteCollection = useCallback(
    (collectionId: string) => {
      updateCollections(collections.filter((collection) => collection.id !== collectionId));
    },
    [collections, updateCollections]
  );

  const updateRecipe = useCallback((updatedRecipe: Recipe) => {
    void saveRecipe(updatedRecipe)
      .then((savedRecipe) => {
        setRecipes((prev) => prev.map((recipe) => (recipe.id === savedRecipe.id ? savedRecipe : recipe)));
        setSelectedRecipe(savedRecipe);
      })
      .catch((error) => {
        console.warn("Failed to update recipe", error);
      });
  }, []);

  const addRecipe = useCallback(async (newRecipe: Recipe) => {
    try {
      const savedRecipe = await saveRecipe(newRecipe);
      setRecipes((prev) => [savedRecipe, ...prev]);
      setSelectedRecipe(savedRecipe);
      return savedRecipe;
    } catch (error) {
      console.warn("Failed to add recipe", error);
      return null;
    }
  }, []);

  const deleteRecipe = useCallback((recipeId: string) => {
    void deleteRecipeRemote(recipeId).catch((error) => {
      console.warn("Failed to delete recipe", error);
    });
    setRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
    updateCollections(
      collections.map((collection) => ({
        ...collection,
        recipeIds: collection.recipeIds.filter((id) => id !== recipeId),
      }))
    );
    setSelectedRecipe((prev) => (prev?.id === recipeId ? null : prev));
  }, [collections, updateCollections]);

  const updateAccountConnection = useCallback((platform: string, connected: boolean) => {
    setConnectedAccounts((prev) => ({ ...prev, [platform]: connected }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      isAuthenticated,
      currentScreen,
      selectedRecipe,
      selectedTab,
      isImportOverlayOpen,
      importItems,
      recipes,
      collections,
      shoppingListItems,
      connectedAccounts,
      userName,
      userEmail,
      userLanguage,
      userCountry,
      needsOnboarding,
      profileReady,
      aiDisabled,
      plan,
      usageSummary,
      bonusImports,
      bonusTokens,
      subscriptionPeriod,
      simulateEmptyState,
      setIsImportOverlayOpen,
      setSelectedRecipe,
      setCurrentScreen,
      setSelectedTab,
      handleLoadingComplete,
      updateProfile,
      deleteAccount,
      logout,
      navigateTo,
      handleRecipeSelect,
      toggleFavorite,
      handleImportAction,
      handleAddToShoppingList,
      updateShoppingListItems,
      createCollection,
      toggleRecipeInCollection,
      deleteCollection,
      updateRecipe,
      addRecipe,
      deleteRecipe,
      updateAccountConnection,
      refreshUsageSummary,
      purchasePayPerUseCredits,
      setSimulateEmptyState,
    }),
    [
      isAuthenticated,
      currentScreen,
      selectedRecipe,
      selectedTab,
      isImportOverlayOpen,
      importItems,
      recipes,
      collections,
      shoppingListItems,
      connectedAccounts,
      userName,
      userEmail,
      userLanguage,
      userCountry,
      needsOnboarding,
      profileReady,
      aiDisabled,
      plan,
      usageSummary,
      bonusImports,
      bonusTokens,
      subscriptionPeriod,
      simulateEmptyState,
      handleLoadingComplete,
      updateProfile,
      deleteAccount,
      logout,
      navigateTo,
      handleRecipeSelect,
      toggleFavorite,
      handleImportAction,
      handleAddToShoppingList,
      updateShoppingListItems,
      createCollection,
      toggleRecipeInCollection,
      deleteCollection,
      updateRecipe,
      addRecipe,
      deleteRecipe,
      updateAccountConnection,
      refreshUsageSummary,
      purchasePayPerUseCredits,
      setSimulateEmptyState,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
