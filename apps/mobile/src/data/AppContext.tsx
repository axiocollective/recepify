import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  BottomTab,
  ImportItem,
  Ingredient,
  PlanTier,
  Recipe,
  RecipeCollection,
  Screen,
  ShoppingListItem,
  UsageSummary,
} from "./types";
import {
  getPlanLimits,
  getImportLimitMessage,
  getImportLimitTitle,
  getAvailableImports,
  getAvailableTranslations,
  getAvailableOptimizations,
  getAvailableAiMessages,
  isImportLimitReached,
  isTranslationLimitReached,
  isOptimizationLimitReached,
  isAiLimitReached,
} from "./usageLimits";
import {
  addShoppingListItems,
  deleteRecipe as deleteRecipeRemote,
  ensureProfile,
  fetchProfile,
  fetchRecipeCollections,
  fetchRecipes,
  fetchShoppingListItems,
  fetchUsageSummary,
  purchaseAddon as purchaseAddonRemote,
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
  addonImports: number;
  addonTranslations: number;
  addonOptimizations: number;
  addonAiMessages: number;
  trialActive: boolean;
  trialImportsRemaining: number;
  trialTranslationsRemaining: number;
  trialOptimizationsRemaining: number;
  trialAiMessagesRemaining: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionStatus: "active" | "canceled" | "expired";
  subscriptionPeriod: "monthly" | "yearly";
  planBillingFocus: "credits" | null;
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
  scheduleSubscriptionCancellation: (endsAt: string) => void;
  deleteAccount: () => Promise<void>;
  logout: () => void;
  navigateTo: (screen: Screen, options?: { focus?: "credits" }) => void;
  handleRecipeSelect: (recipe: Recipe) => void;
  toggleFavorite: (recipeId: string) => void;
  handleImportAction: (itemId: string, action: "open" | "connect" | "retry" | "delete") => Promise<void>;
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
  purchaseAddon: (action: "import" | "translation" | "optimization" | "ai_message", quantity: number) => Promise<void>;
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
  const [plan, setPlan] = useState<PlanTier>("base");
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [addonImports, setAddonImports] = useState(0);
  const [addonTranslations, setAddonTranslations] = useState(0);
  const [addonOptimizations, setAddonOptimizations] = useState(0);
  const [addonAiMessages, setAddonAiMessages] = useState(0);
  const [trialStartsAt, setTrialStartsAt] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialImports, setTrialImports] = useState(0);
  const [trialTranslations, setTrialTranslations] = useState(0);
  const [trialOptimizations, setTrialOptimizations] = useState(0);
  const [trialAiMessages, setTrialAiMessages] = useState(0);
  const [trialImportsUsed, setTrialImportsUsed] = useState(0);
  const [trialTranslationsUsed, setTrialTranslationsUsed] = useState(0);
  const [trialOptimizationsUsed, setTrialOptimizationsUsed] = useState(0);
  const [trialAiMessagesUsed, setTrialAiMessagesUsed] = useState(0);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<"active" | "canceled" | "expired">("active");
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<"monthly" | "yearly">("yearly");
  const [planBillingFocus, setPlanBillingFocus] = useState<"credits" | null>(null);
  const trialEndAlertShownRef = useRef(false);
  const subscriptionEndAlertShownRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [simulateEmptyState, setSimulateEmptyState] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);
  const videoFallbackAlerts = useRef(new Set<string>());
  const previousAuthRef = useRef(isAuthenticated);
  const [authCreatedAt, setAuthCreatedAt] = useState<string | null>(null);
  const lastUsageSummaryRef = useRef<UsageSummary | null>(null);

  const createUuid = useCallback(
    () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      }),
    []
  );
  const TRIAL_IMPORTS = 10;
  const TRIAL_TRANSLATIONS = 10;
  const TRIAL_OPTIMIZATIONS = 10;
  const TRIAL_AI_MESSAGES = 100;
  const TRIAL_DAYS = 14;
  const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 24 * 60 * 60 * 1000);

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
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      return "youtube";
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
    if (platform === "youtube") {
      return "YouTube recipe link";
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

  const processIncomingShare = useCallback(
    (incoming?: string | null) => {
      const sharedUrl = extractSharedUrl(incoming);
      if (!sharedUrl) return false;
      const didAdd = addImportItemFromUrl(sharedUrl);
      if (didAdd) {
        Alert.alert("Saved to inbox", "This link was added to your import inbox.");
      }
      return didAdd;
    },
    [addImportItemFromUrl, extractSharedUrl]
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
        const normalizedPlan = (() => {
          const rawPlan = profile.plan as string | null | undefined;
          if (rawPlan === "base") return "base";
          if (rawPlan === "premium") return "premium";
          if (rawPlan === "free") return "base";
          if (rawPlan === "paid") return "premium";
          if (rawPlan === "ai_disabled") return "ai_disabled";
          return "base";
        })();
        const nextPlan = normalizedPlan === "ai_disabled" ? "base" : normalizedPlan;
        setAiDisabled(nextAiDisabled);
        setPlan(nextPlan);
        setAddonImports(profile.addon_imports ?? 0);
        setAddonTranslations(profile.addon_translations ?? 0);
        setAddonOptimizations(profile.addon_optimizations ?? 0);
        setAddonAiMessages(profile.addon_ai_messages ?? 0);
        setSubscriptionPeriod(profile.subscription_period === "monthly" ? "monthly" : "yearly");
        setSubscriptionEndsAt(profile.subscription_ends_at ? new Date(profile.subscription_ends_at).toISOString() : null);
        setSubscriptionStatus(
          profile.subscription_status === "canceled" || profile.subscription_status === "expired"
            ? profile.subscription_status
            : "active"
        );
        const now = new Date();
        const profileCreatedAt = profile.created_at ? new Date(profile.created_at) : null;
        const trialStart =
          profile.trial_started_at
            ? new Date(profile.trial_started_at)
            : profileCreatedAt ?? (authCreatedAt ? new Date(authCreatedAt) : now);
        const trialEnd =
          profile.trial_ends_at
            ? new Date(profile.trial_ends_at)
            : addDays(trialStart, TRIAL_DAYS);
        const hasTrial = Boolean(profile.trial_started_at);
        if (!hasTrial) {
          void ensureProfile({
            trialStartedAt: trialStart.toISOString(),
            trialEndsAt: trialEnd.toISOString(),
            trialImports: TRIAL_IMPORTS,
            trialTranslations: TRIAL_TRANSLATIONS,
            trialOptimizations: TRIAL_OPTIMIZATIONS,
            trialAiMessages: TRIAL_AI_MESSAGES,
            trialImportsUsed: 0,
            trialTranslationsUsed: 0,
            trialOptimizationsUsed: 0,
            trialAiMessagesUsed: 0,
          });
        }
        const trialExpired = trialEnd.getTime() <= now.getTime();
        if (
          trialExpired &&
          (profile.trial_imports ||
            profile.trial_translations ||
            profile.trial_optimizations ||
            profile.trial_ai_messages ||
            profile.plan !== "base" ||
            profile.subscription_period !== "monthly")
        ) {
          void ensureProfile({
            trialImports: 0,
            trialTranslations: 0,
            trialOptimizations: 0,
            trialAiMessages: 0,
            plan: "base",
            subscriptionPeriod: "monthly",
          });
        }
        if (trialExpired && nextPlan !== "base") {
          setPlan("base");
        }
        if (trialExpired) {
          setSubscriptionPeriod("monthly");
        }
        setTrialStartsAt(trialStart.toISOString());
        setTrialEndsAt(trialEnd.toISOString());
        setTrialImports(trialExpired ? 0 : (profile.trial_imports ?? TRIAL_IMPORTS));
        setTrialTranslations(trialExpired ? 0 : (profile.trial_translations ?? TRIAL_TRANSLATIONS));
        setTrialOptimizations(trialExpired ? 0 : (profile.trial_optimizations ?? TRIAL_OPTIMIZATIONS));
        setTrialAiMessages(trialExpired ? 0 : (profile.trial_ai_messages ?? TRIAL_AI_MESSAGES));
        setTrialImportsUsed(profile.trial_imports_used ?? 0);
        setTrialTranslationsUsed(profile.trial_translations_used ?? 0);
        setTrialOptimizationsUsed(profile.trial_optimizations_used ?? 0);
        setTrialAiMessagesUsed(profile.trial_ai_messages_used ?? 0);
      } else {
        const now = new Date();
        const trialStart = authCreatedAt ? new Date(authCreatedAt) : now;
        const trialEnd = addDays(trialStart, TRIAL_DAYS);
        void ensureProfile({
          trialStartedAt: trialStart.toISOString(),
          trialEndsAt: trialEnd.toISOString(),
          trialImports: TRIAL_IMPORTS,
          trialTranslations: TRIAL_TRANSLATIONS,
          trialOptimizations: TRIAL_OPTIMIZATIONS,
          trialAiMessages: TRIAL_AI_MESSAGES,
          trialImportsUsed: 0,
          trialTranslationsUsed: 0,
          trialOptimizationsUsed: 0,
          trialAiMessagesUsed: 0,
        });
        setTrialStartsAt(trialStart.toISOString());
        setTrialEndsAt(trialEnd.toISOString());
        setTrialImports(TRIAL_IMPORTS);
        setTrialTranslations(TRIAL_TRANSLATIONS);
        setTrialOptimizations(TRIAL_OPTIMIZATIONS);
        setTrialAiMessages(TRIAL_AI_MESSAGES);
        setTrialImportsUsed(0);
        setTrialTranslationsUsed(0);
        setTrialOptimizationsUsed(0);
        setTrialAiMessagesUsed(0);
        setSubscriptionEndsAt(null);
        setSubscriptionStatus("active");
        setNeedsOnboarding(true);
        setImportItems([]);
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

  useEffect(() => {
    if (!usageSummary) return;
    const trialActive = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > Date.now());
    const previous = lastUsageSummaryRef.current;
    const samePeriod = previous && previous.periodStart === usageSummary.periodStart;
    const importDelta = samePeriod ? usageSummary.importCount - (previous?.importCount ?? 0) : usageSummary.importCount;
    const translationDelta = samePeriod
      ? usageSummary.translationCount - (previous?.translationCount ?? 0)
      : usageSummary.translationCount;
    const optimizationDelta = samePeriod
      ? usageSummary.optimizationCount - (previous?.optimizationCount ?? 0)
      : usageSummary.optimizationCount;
    const aiDelta = samePeriod
      ? usageSummary.aiMessagesCount - (previous?.aiMessagesCount ?? 0)
      : usageSummary.aiMessagesCount;

    const consume = (
      delta: number,
      trialTotal: number,
      trialUsed: number,
      setTrialUsed: (value: number) => void,
      addon: number,
      setAddon: (value: number) => void,
      trialUsedField: "trialImportsUsed" | "trialTranslationsUsed" | "trialOptimizationsUsed" | "trialAiMessagesUsed",
      addonField: "addonImports" | "addonTranslations" | "addonOptimizations" | "addonAiMessages"
    ) => {
      if (delta <= 0) return;
      let remaining = delta;
      if (trialActive) {
        const trialRemaining = Math.max(0, trialTotal - trialUsed);
        if (trialRemaining > 0) {
          const useTrial = Math.min(remaining, trialRemaining);
          const nextUsed = trialUsed + useTrial;
          setTrialUsed(nextUsed);
          void ensureProfile({ [trialUsedField]: nextUsed } as any);
          remaining -= useTrial;
        }
      }
      if (remaining > 0 && addon > 0) {
        const nextAddon = Math.max(0, addon - remaining);
        setAddon(nextAddon);
        void ensureProfile({ [addonField]: nextAddon } as any);
        remaining = Math.max(0, remaining - addon);
      }
    };

    consume(
      importDelta,
      trialImports,
      trialImportsUsed,
      setTrialImportsUsed,
      addonImports,
      setAddonImports,
      "trialImportsUsed",
      "addonImports"
    );
    consume(
      translationDelta,
      trialTranslations,
      trialTranslationsUsed,
      setTrialTranslationsUsed,
      addonTranslations,
      setAddonTranslations,
      "trialTranslationsUsed",
      "addonTranslations"
    );
    consume(
      optimizationDelta,
      trialOptimizations,
      trialOptimizationsUsed,
      setTrialOptimizationsUsed,
      addonOptimizations,
      setAddonOptimizations,
      "trialOptimizationsUsed",
      "addonOptimizations"
    );
    consume(
      aiDelta,
      trialAiMessages,
      trialAiMessagesUsed,
      setTrialAiMessagesUsed,
      addonAiMessages,
      setAddonAiMessages,
      "trialAiMessagesUsed",
      "addonAiMessages"
    );

    lastUsageSummaryRef.current = usageSummary;
  }, [
    addonAiMessages,
    addonImports,
    addonOptimizations,
    addonTranslations,
    plan,
    trialAiMessages,
    trialAiMessagesUsed,
    trialEndsAt,
    trialImports,
    trialImportsUsed,
    trialOptimizations,
    trialOptimizationsUsed,
    trialTranslations,
    trialTranslationsUsed,
    usageSummary,
  ]);

  const purchaseAddon = useCallback(
    async (action: "import" | "translation" | "optimization" | "ai_message", quantity: number) => {
      try {
        const next = await purchaseAddonRemote({ action, quantity });
        setAddonImports(next.addonImports);
        setAddonTranslations(next.addonTranslations);
        setAddonOptimizations(next.addonOptimizations);
        setAddonAiMessages(next.addonAiMessages);
        Alert.alert("Added", "The add-on was added to your account.");
      } catch (error) {
        console.warn("Failed to purchase add-on", error);
        Alert.alert("Purchase failed", "Please try again in a moment.");
      }
    },
    []
  );


  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const session = data.session;
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      setSupabaseUserId(nextUserId);
      setIsAuthenticated(Boolean(session));
      setAuthCreatedAt(session?.user?.created_at ?? null);
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
      setAuthCreatedAt(session?.user?.created_at ?? null);
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
    const handleIncoming = (incoming?: string | null) => {
      processIncomingShare(incoming);
    };

    void Linking.getInitialURL().then(handleIncoming).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => handleIncoming(url));

    return () => {
      subscription.remove();
    };
  }, [processIncomingShare]);

  useEffect(() => {
    let isActive = true;
    const handleClipboard = async () => {
      try {
        const value = await Clipboard.getStringAsync();
        if (!isActive || !value) return;
        if (!value.startsWith("recepify-share:")) return;
        const url = value.replace("recepify-share:", "").trim();
        if (!url) return;
        const didAdd = processIncomingShare(url);
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
  }, [processIncomingShare]);

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

  useEffect(() => {
    if (!previousAuthRef.current && isAuthenticated) {
      setCurrentScreen("welcome");
      setSelectedTab("home");
      setSelectedRecipe(null);
    }
    previousAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!trialEndsAt) return;
    const now = Date.now();
    const endsAt = new Date(trialEndsAt).getTime();
    if (endsAt <= now) {
      if (trialImports > 0 || trialTranslations > 0 || trialOptimizations > 0 || trialAiMessages > 0) {
        setTrialImports(0);
        setTrialTranslations(0);
        setTrialOptimizations(0);
        setTrialAiMessages(0);
      }
      void ensureProfile({
        trialImports: 0,
        trialTranslations: 0,
        trialOptimizations: 0,
        trialAiMessages: 0,
        plan: "base",
        subscriptionPeriod: "monthly",
      });
      setPlan("base");
      setSubscriptionPeriod("monthly");
      if (!trialEndAlertShownRef.current) {
        trialEndAlertShownRef.current = true;
        Alert.alert(
          "Trial ended",
          "Your trial has ended. You’re now on Recepify Base (monthly). Trial actions and imports have expired.",
          [
            { text: "OK" },
            {
              text: "Subscription",
              style: "cancel",
              onPress: () => {
                setSelectedTab("profile");
                setCurrentScreen("planBilling");
              },
            },
          ]
        );
      }
    }
  }, [trialEndsAt, trialAiMessages, trialImports, trialOptimizations, trialTranslations]);

  useEffect(() => {
    if (!subscriptionEndsAt || !isAuthenticated) return;
    const endsAt = new Date(subscriptionEndsAt).getTime();
    if (Number.isNaN(endsAt) || endsAt > Date.now()) return;
    if (!subscriptionEndAlertShownRef.current) {
      subscriptionEndAlertShownRef.current = true;
      setSubscriptionStatus("expired");
      void ensureProfile({ subscriptionStatus: "expired" });
      Alert.alert(
        "Subscription ended",
        "Your subscription has ended. Please sign in again to continue.",
        [{ text: "OK", onPress: () => logout() }]
      );
      return;
    }
    logout();
  }, [isAuthenticated, logout, subscriptionEndsAt]);

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

  const scheduleSubscriptionCancellation = useCallback((endsAt: string) => {
    setSubscriptionEndsAt(endsAt);
    setSubscriptionStatus("canceled");
    void ensureProfile({ subscriptionEndsAt: endsAt, subscriptionStatus: "canceled" });
  }, []);

  const updateProfile = useCallback((payload: { name?: string; email?: string; language?: "English" | "German"; country?: string; aiDisabled?: boolean; plan?: PlanTier; subscriptionPeriod?: "monthly" | "yearly" }) => {
    const nextName = payload.name ?? userName;
    const nextLanguage = payload.language ?? userLanguage;
    const nextCountry = payload.country ?? userCountry;
    const nextPlan = payload.plan === "ai_disabled" ? "base" : payload.plan ?? plan;
    const nextSubscriptionPeriod = payload.subscriptionPeriod ?? subscriptionPeriod;
    const nextAiDisabled = payload.aiDisabled ?? aiDisabled;

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
      setPlan(payload.plan === "ai_disabled" ? "base" : payload.plan);
      setSubscriptionEndsAt(null);
      setSubscriptionStatus("active");
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
      subscriptionEndsAt: payload.plan !== undefined ? null : subscriptionEndsAt,
      subscriptionStatus: payload.plan !== undefined ? "active" : subscriptionStatus,
    });
  }, [aiDisabled, plan, subscriptionEndsAt, subscriptionPeriod, userCountry, userLanguage, userName]);

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
    setPlan("base");
    setAddonImports(0);
    setAddonTranslations(0);
    setAddonOptimizations(0);
    setAddonAiMessages(0);
    setTrialStartsAt(null);
    setTrialEndsAt(null);
    setTrialImports(0);
    setTrialTranslations(0);
    setTrialOptimizations(0);
    setTrialAiMessages(0);
    setTrialImportsUsed(0);
    setTrialTranslationsUsed(0);
    setTrialOptimizationsUsed(0);
    setTrialAiMessagesUsed(0);
    setUsageSummary(null);
  }, [userId]);

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentScreen("welcome");
    setSelectedTab("home");
    setCollections([]);
    setProfileReady(false);
    setAddonImports(0);
    setAddonTranslations(0);
    setAddonOptimizations(0);
    setAddonAiMessages(0);
    setTrialStartsAt(null);
    setTrialEndsAt(null);
    setTrialImports(0);
    setTrialTranslations(0);
    setTrialOptimizations(0);
    setTrialAiMessages(0);
    setTrialImportsUsed(0);
    setTrialTranslationsUsed(0);
    setTrialOptimizationsUsed(0);
    setTrialAiMessagesUsed(0);
    setSubscriptionEndsAt(null);
    setSubscriptionStatus("active");
  }, []);

  const navigateTo = useCallback((screen: Screen, options?: { focus?: "credits" }) => {
    setCurrentScreen(screen);
    if (screen === "planBilling") {
      setPlanBillingFocus(options?.focus ?? null);
    } else {
      setPlanBillingFocus(null);
    }
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
    async (itemId: string, action: "open" | "connect" | "retry" | "delete") => {
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
        const importLimitReached = isImportLimitReached(plan, usageSummary, trialActive, addonImports, trialImportsRemaining);
        if (importLimitReached) {
          const limitMessage = getImportLimitMessage(plan);
          const limitTitle = getImportLimitTitle(plan);
          Alert.alert(limitTitle, limitMessage, [
            { text: "Buy more", onPress: () => navigateTo("planBilling", { focus: "credits" }) },
            { text: "Cancel", style: "cancel" },
          ]);
          return;
        }
        setImportItems((prev) =>
          prev.map((importItem) =>
            importItem.id === itemId ? { ...importItem, status: "processing" } : importItem
          )
        );
        try {
          const imported = await importFromUrl(item.url);
          const saved = await addRecipe(imported);
          const nextRecipe = saved ?? imported;
          setSelectedRecipe(nextRecipe);
          setCurrentScreen("recipeDetail");
          refreshUsageSummary();
          setImportItems((prev) => prev.filter((importItem) => importItem.id !== itemId));
            const alertKey = nextRecipe.id || nextRecipe.sourceUrl || nextRecipe.title;
            if ((nextRecipe.source === "tiktok" || nextRecipe.source === "instagram") && !nextRecipe.videoUrl) {
              if (!alertKey || !videoFallbackAlerts.current.has(alertKey)) {
                if (alertKey) {
                  videoFallbackAlerts.current.add(alertKey);
                }
                Alert.alert(
                  "Video not accessible",
                  "We couldn’t read the video, so we used the caption text instead. Please review the recipe before saving."
                );
              }
            }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? "");
          if (message.includes("YOUTUBE_TOO_LONG_NO_DESC")) {
            Alert.alert(
              "Video too long to import",
              "This video is longer than 15 minutes and doesn’t include ingredients in the description. Please try another link or add the recipe manually. No actions were used."
            );
          } else {
            Alert.alert(
              "Import didn’t work",
              "We couldn’t read this link properly. Please try again or use a different link. No actions were used."
            );
          }
          setImportItems((prev) =>
            prev.map((importItem) =>
              importItem.id === itemId ? { ...importItem, status: "failed" } : importItem
            )
          );
        }
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
    [addRecipe, addonImports, handleRecipeSelect, importItems, plan, recipes, refreshUsageSummary, trialActive, trialImportsRemaining, usageSummary, navigateTo]
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

  const trialActive = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > Date.now());
  const trialImportsRemaining = trialActive
    ? Math.max(0, trialImports - trialImportsUsed)
    : 0;
  const trialTranslationsRemaining = trialActive
    ? Math.max(0, trialTranslations - trialTranslationsUsed)
    : 0;
  const trialOptimizationsRemaining = trialActive
    ? Math.max(0, trialOptimizations - trialOptimizationsUsed)
    : 0;
  const trialAiMessagesRemaining = trialActive
    ? Math.max(0, trialAiMessages - trialAiMessagesUsed)
    : 0;

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
      addonImports,
      addonTranslations,
      addonOptimizations,
      addonAiMessages,
      trialActive,
      trialImportsRemaining,
      trialTranslationsRemaining,
      trialOptimizationsRemaining,
      trialAiMessagesRemaining,
      trialEndsAt,
      subscriptionEndsAt,
      subscriptionStatus,
      subscriptionPeriod,
      planBillingFocus,
      simulateEmptyState,
      setIsImportOverlayOpen,
      setSelectedRecipe,
      setCurrentScreen,
      setSelectedTab,
      handleLoadingComplete,
      updateProfile,
      scheduleSubscriptionCancellation,
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
      purchaseAddon,
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
      addonImports,
      addonTranslations,
      addonOptimizations,
      addonAiMessages,
      trialActive,
      trialImportsRemaining,
      trialTranslationsRemaining,
      trialOptimizationsRemaining,
      trialAiMessagesRemaining,
      trialEndsAt,
      subscriptionEndsAt,
      subscriptionStatus,
      subscriptionPeriod,
      planBillingFocus,
      simulateEmptyState,
      handleLoadingComplete,
      updateProfile,
      scheduleSubscriptionCancellation,
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
      purchaseAddon,
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
