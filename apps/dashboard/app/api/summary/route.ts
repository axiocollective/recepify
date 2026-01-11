import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { ProfileRow, UsageEvent, UsageSummary } from "../../lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string | null | undefined, fallback: "start" | "end") => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (fallback === "start") {
      date.setUTCHours(0, 0, 0, 0);
    } else {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (fallback === "start") {
      date.setUTCHours(0, 0, 0, 0);
    } else {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  if (fallback === "start") {
    parsed.setUTCHours(0, 0, 0, 0);
  } else {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
};

const toDayKey = (date: Date) => date.toISOString().slice(0, 10);
const normalizeModelName = (value: string | null | undefined) =>
  value && String(value).trim() ? String(value) : "No model";

const resolveOwnerIdsByEmail = async (emailQuery: string) => {
  const normalized = emailQuery.trim().toLowerCase();
  if (!normalized) return [];
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data?.users) return [];
  return data.users
    .filter((user) => user.email && user.email.toLowerCase().includes(normalized))
    .map((user) => user.id);
};

const resolveOwnerIdsByProfileFilters = async (
  userName: string | null,
  language: string | null,
  country: string | null
) => {
  let query = supabaseAdmin.from("profiles").select("id");
  if (userName) {
    query = query.ilike("name", `%${userName.trim()}%`);
  }
  if (language) {
    query = query.eq("language", language);
  }
  if (country) {
    query = query.eq("country", country);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => row.id);
};

const intersectIds = (a: string[] | null, b: string[] | null) => {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
};

const getDateRange = (start?: string | null, end?: string | null) => {
  const endDate = parseDate(end, "end") ?? new Date();
  const startDate =
    parseDate(start, "start") ?? new Date(endDate.getTime() - 29 * DAY_MS);
  startDate.setUTCHours(0, 0, 0, 0);
  return { startDate, endDate };
};

const normalizeDay = (value: string) => value.slice(0, 10);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const userName = searchParams.get("userName");
  const language = searchParams.get("language");
  const country = searchParams.get("country");
  const eventType = searchParams.get("eventType");
  const source = searchParams.get("source");
  const model = searchParams.get("model");
  const usageContext = searchParams.get("usageContext");
  const { startDate, endDate } = getDateRange(
    searchParams.get("start"),
    searchParams.get("end")
  );
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  let profilesQuery = supabaseAdmin
    .from("profiles")
    .select(
      "id, name, plan, subscription_period, trial_ends_at, trial_canceled_at, subscription_status, language, country, bonus_imports, bonus_tokens, trial_imports, trial_tokens, trial_imports_used, trial_tokens_used, trial_translations, trial_translations_used, trial_optimizations, trial_optimizations_used, trial_ai_messages, trial_ai_messages_used, addon_imports, addon_translations, addon_optimizations, addon_ai_messages"
    );
  let eventsQuery = supabaseAdmin
    .from("usage_events")
    .select(
      "owner_id, event_type, source, model_provider, model_name, ai_credits_used, import_credits_used, cost_usd, created_at, metadata"
    )
    .gte("created_at", startIso)
    .lte("created_at", endIso);
  let monthlyQuery = supabaseAdmin
    .from("usage_monthly")
    .select("owner_id, period_start, import_count, translations_count, optimizations_count, ai_messages_count, ai_tokens")
    .gte("period_start", startIso.slice(0, 10))
    .lte("period_start", endIso.slice(0, 10));
  const currentPeriodKey = toDayKey(
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  );
  let currentUsageQuery = supabaseAdmin
    .from("usage_monthly")
    .select("owner_id, import_count, translations_count, optimizations_count, ai_messages_count, ai_tokens")
    .eq("period_start", currentPeriodKey);
  let monthlyImportsQuery = supabaseAdmin
    .from("import_usage_monthly")
    .select("owner_id, source, import_count")
    .gte("period_start", startIso.slice(0, 10))
    .lte("period_start", endIso.slice(0, 10));

  let ownerIds: string[] | null = null;
  if (email) {
    ownerIds = await resolveOwnerIdsByEmail(email);
  }
  if (userName || language || country) {
    const profileIds = await resolveOwnerIdsByProfileFilters(userName, language, country);
    ownerIds = intersectIds(ownerIds, profileIds);
  }
  if (ownerIds && ownerIds.length === 0) {
    return NextResponse.json({
      totalUsers: 0,
      baseUsers: 0,
      premiumUsers: 0,
      trialUsers: 0,
      canceledUsers: 0,
      canceledTrialUsers: 0,
      baseMonthlyUsers: 0,
      baseYearlyUsers: 0,
      premiumMonthlyUsers: 0,
      premiumYearlyUsers: 0,
      freeUsers: 0,
      usersByCountry: [],
      usersByLanguage: [],
      actionTotals: [],
      contextTotals: [],
      creditInventory: [],
      totalImports: 0,
      totalAiCredits: 0,
      totalCostUsd: 0,
      totalWhisperSeconds: 0,
      totalVisionImages: 0,
      currentPeriodImportsUsed: 0,
      currentPeriodTranslationsUsed: 0,
      currentPeriodOptimizationsUsed: 0,
      currentPeriodAiMessagesUsed: 0,
      currentPeriodAiUsed: 0,
      totalImportCreditsAvailable: 0,
      totalTranslationCreditsAvailable: 0,
      totalOptimizationCreditsAvailable: 0,
      totalAiMessageCreditsAvailable: 0,
      totalAiCreditsAvailable: 0,
      activeUsers: 0,
      dailySeries: [],
      bySource: [],
      byModel: [],
      modelBreakdown: [],
      actionModelBreakdown: [],
      importBreakdown: [],
      sourceImportSeries: [],
      actionCountSeries: [],
      actionCreditSeries: [],
      actionCostSeries: [],
      contextCountSeries: [],
      costByUser: [],
      actionSeries: [],
      sourceSeries: [],
      contextSeries: [],
    } satisfies UsageSummary);
  }
  if (userId) {
    if (ownerIds && !ownerIds.includes(userId)) {
      return NextResponse.json({
        totalUsers: 0,
        baseUsers: 0,
        premiumUsers: 0,
        trialUsers: 0,
        canceledUsers: 0,
        canceledTrialUsers: 0,
        baseMonthlyUsers: 0,
        baseYearlyUsers: 0,
        premiumMonthlyUsers: 0,
        premiumYearlyUsers: 0,
        freeUsers: 0,
        usersByCountry: [],
        usersByLanguage: [],
        actionTotals: [],
        contextTotals: [],
        creditInventory: [],
        totalImports: 0,
        totalAiCredits: 0,
        totalCostUsd: 0,
        totalWhisperSeconds: 0,
        totalVisionImages: 0,
        currentPeriodImportsUsed: 0,
        currentPeriodTranslationsUsed: 0,
        currentPeriodOptimizationsUsed: 0,
        currentPeriodAiMessagesUsed: 0,
        currentPeriodAiUsed: 0,
        totalImportCreditsAvailable: 0,
        totalTranslationCreditsAvailable: 0,
        totalOptimizationCreditsAvailable: 0,
        totalAiMessageCreditsAvailable: 0,
        totalAiCreditsAvailable: 0,
        activeUsers: 0,
        dailySeries: [],
        bySource: [],
        byModel: [],
        modelBreakdown: [],
        actionModelBreakdown: [],
        importBreakdown: [],
        sourceImportSeries: [],
        actionCountSeries: [],
        actionCreditSeries: [],
        actionCostSeries: [],
        contextCountSeries: [],
        costByUser: [],
        actionSeries: [],
        sourceSeries: [],
        contextSeries: [],
      } satisfies UsageSummary);
    }
    profilesQuery = profilesQuery.eq("id", userId);
    eventsQuery = eventsQuery.eq("owner_id", userId);
    monthlyQuery = monthlyQuery.eq("owner_id", userId);
    monthlyImportsQuery = monthlyImportsQuery.eq("owner_id", userId);
    currentUsageQuery = currentUsageQuery.eq("owner_id", userId);
  } else if (ownerIds) {
    profilesQuery = profilesQuery.in("id", ownerIds);
    eventsQuery = eventsQuery.in("owner_id", ownerIds);
    monthlyQuery = monthlyQuery.in("owner_id", ownerIds);
    monthlyImportsQuery = monthlyImportsQuery.in("owner_id", ownerIds);
    currentUsageQuery = currentUsageQuery.in("owner_id", ownerIds);
  }
  if (eventType) {
    eventsQuery = eventsQuery.eq("event_type", eventType);
  }
  if (source) {
    eventsQuery = eventsQuery.eq("source", source);
  }
  if (model) {
    eventsQuery = eventsQuery.eq("model_name", model);
  }
  if (usageContext) {
    eventsQuery = eventsQuery.filter("metadata->>usage_context", "eq", usageContext);
  }

  const [
    { data: profiles, error: profileError },
    { data: events, error: eventsError },
    { data: monthlyUsage, error: monthlyError },
    { data: monthlyImports, error: monthlyImportsError },
    { data: currentUsage, error: currentUsageError },
    { data: planLimits, error: planLimitsError },
  ] = await Promise.all([
    profilesQuery,
    eventsQuery,
    monthlyQuery,
    monthlyImportsQuery,
    currentUsageQuery,
    supabaseAdmin.from("plan_action_limits").select("plan, imports, translations, optimizations, ai_messages"),
  ]);

  let addonPurchases: Array<{ action_type: string; quantity: number }> = [];
  const { data: addonData, error: addonError } = await supabaseAdmin
    .from("addon_purchases")
    .select("action_type, quantity");
  if (!addonError && addonData) {
    addonPurchases = addonData as Array<{ action_type: string; quantity: number }>;
  }

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }
  if (monthlyError) {
    return NextResponse.json({ error: monthlyError.message }, { status: 500 });
  }
  if (monthlyImportsError) {
    return NextResponse.json({ error: monthlyImportsError.message }, { status: 500 });
  }
  if (currentUsageError) {
    return NextResponse.json({ error: currentUsageError.message }, { status: 500 });
  }
  if (planLimitsError) {
    return NextResponse.json({ error: planLimitsError.message }, { status: 500 });
  }

  const safeProfiles = (profiles ?? []) as ProfileRow[];
  const safeEvents = (events ?? []) as UsageEvent[];
  const safeMonthly = (monthlyUsage ?? []) as Array<{
    owner_id: string;
    period_start: string;
    import_count: number;
    translations_count?: number | null;
    optimizations_count?: number | null;
    ai_messages_count?: number | null;
    ai_tokens: number;
  }>;
  const safeMonthlyImports = (monthlyImports ?? []) as Array<{
    owner_id?: string;
    source: string | null;
    import_count: number;
  }>;
  const safeCurrentUsage = (currentUsage ?? []) as Array<{
    owner_id?: string;
    import_count: number;
    translations_count?: number | null;
    optimizations_count?: number | null;
    ai_messages_count?: number | null;
    ai_tokens: number;
  }>;

  const planLimitsMap = new Map(
    (planLimits ?? []).map((row) => [
      row.plan,
      {
        imports: Number(row.imports ?? 0),
        translations: Number(row.translations ?? 0),
        optimizations: Number(row.optimizations ?? 0),
        ai_messages: Number(row.ai_messages ?? 0),
      },
    ])
  );
  const now = Date.now();
  let baseUsers = 0;
  let premiumUsers = 0;
  let trialUsers = 0;
  let canceledUsers = 0;
  let canceledTrialUsers = 0;
  let baseMonthlyUsers = 0;
  let baseYearlyUsers = 0;
  let premiumMonthlyUsers = 0;
  let premiumYearlyUsers = 0;
  let totalImportCreditsAvailable = 0;
  let totalTranslationCreditsAvailable = 0;
  let totalOptimizationCreditsAvailable = 0;
  let totalAiMessageCreditsAvailable = 0;
  let totalPlanImportsAvailable = 0;
  let totalPlanTranslationsAvailable = 0;
  let totalPlanOptimizationsAvailable = 0;
  let totalPlanAiMessagesAvailable = 0;
  let totalTrialImportsRemaining = 0;
  let totalTrialTranslationsRemaining = 0;
  let totalTrialOptimizationsRemaining = 0;
  let totalTrialAiMessagesRemaining = 0;
  let totalAiCreditsAvailable = 0;
  let currentPeriodImportsUsed = 0;
  let currentPeriodTranslationsUsed = 0;
  let currentPeriodOptimizationsUsed = 0;
  let currentPeriodAiMessagesUsed = 0;
  let currentPeriodAiUsed = 0;
  let totalAddonImportsRemaining = 0;
  let totalAddonTranslationsRemaining = 0;
  let totalAddonOptimizationsRemaining = 0;
  let totalAddonAiMessagesRemaining = 0;
  const usersByCountry = new Map<string, number>();
  const usersByLanguage = new Map<string, number>();

  safeProfiles.forEach((profile) => {
    const plan = profile.plan ?? "base";
    const normalizedPlan = plan === "paid" ? "premium" : plan;
    if (plan === "premium") {
      premiumUsers += 1;
      if (profile.subscription_period === "monthly") {
        premiumMonthlyUsers += 1;
      } else if (profile.subscription_period === "yearly") {
        premiumYearlyUsers += 1;
      }
    } else {
      baseUsers += 1;
      if (profile.subscription_period === "monthly") {
        baseMonthlyUsers += 1;
      } else if (profile.subscription_period === "yearly") {
        baseYearlyUsers += 1;
      }
    }
    if (profile.subscription_status === "canceled" || profile.subscription_status === "expired") {
      canceledUsers += 1;
    }
    const trialEnds = profile.trial_ends_at ? Date.parse(profile.trial_ends_at) : null;
    const trialActive = Boolean(trialEnds && trialEnds > now);
    if (trialActive) {
      trialUsers += 1;
    }
    if (trialActive && profile.trial_canceled_at) {
      canceledTrialUsers += 1;
    }
    const planLimits = planLimitsMap.get(normalizedPlan) ?? {
      imports: 0,
      translations: 0,
      optimizations: 0,
      ai_messages: 0,
    };
    const addonImports = Math.max(0, profile.addon_imports ?? 0);
    const addonTranslations = Math.max(0, profile.addon_translations ?? 0);
    const addonOptimizations = Math.max(0, profile.addon_optimizations ?? 0);
    const addonAiMessages = Math.max(0, profile.addon_ai_messages ?? 0);
    const trialImportsRemaining = trialActive
      ? Math.max(0, (profile.trial_imports ?? 0) - (profile.trial_imports_used ?? 0))
      : 0;
    const trialTranslationsRemaining = trialActive
      ? Math.max(0, (profile.trial_translations ?? 0) - (profile.trial_translations_used ?? 0))
      : 0;
    const trialOptimizationsRemaining = trialActive
      ? Math.max(0, (profile.trial_optimizations ?? 0) - (profile.trial_optimizations_used ?? 0))
      : 0;
    const trialAiMessagesRemaining = trialActive
      ? Math.max(0, (profile.trial_ai_messages ?? 0) - (profile.trial_ai_messages_used ?? 0))
      : 0;

    totalImportCreditsAvailable += planLimits.imports + addonImports + trialImportsRemaining;
    totalTranslationCreditsAvailable +=
      planLimits.translations + addonTranslations + trialTranslationsRemaining;
    totalOptimizationCreditsAvailable +=
      planLimits.optimizations + addonOptimizations + trialOptimizationsRemaining;
    totalAiMessageCreditsAvailable +=
      planLimits.ai_messages + addonAiMessages + trialAiMessagesRemaining;
    totalAiCreditsAvailable +=
      planLimits.translations +
      planLimits.optimizations +
      planLimits.ai_messages +
      addonTranslations +
      addonOptimizations +
      addonAiMessages +
      trialTranslationsRemaining +
      trialOptimizationsRemaining +
      trialAiMessagesRemaining;

    totalAddonImportsRemaining += addonImports;
    totalAddonTranslationsRemaining += addonTranslations;
    totalAddonOptimizationsRemaining += addonOptimizations;
    totalAddonAiMessagesRemaining += addonAiMessages;

    totalPlanImportsAvailable += planLimits.imports;
    totalPlanTranslationsAvailable += planLimits.translations;
    totalPlanOptimizationsAvailable += planLimits.optimizations;
    totalPlanAiMessagesAvailable += planLimits.ai_messages;
    totalTrialImportsRemaining += trialImportsRemaining;
    totalTrialTranslationsRemaining += trialTranslationsRemaining;
    totalTrialOptimizationsRemaining += trialOptimizationsRemaining;
    totalTrialAiMessagesRemaining += trialAiMessagesRemaining;

    const languageKey = profile.language?.trim() || "Unknown";
    usersByLanguage.set(languageKey, (usersByLanguage.get(languageKey) ?? 0) + 1);
    const countryKey = profile.country?.trim() || "Unknown";
    usersByCountry.set(countryKey, (usersByCountry.get(countryKey) ?? 0) + 1);
  });

  for (const entry of safeCurrentUsage) {
    currentPeriodImportsUsed += Number(entry.import_count || 0);
    currentPeriodTranslationsUsed += Number(entry.translations_count || 0);
    currentPeriodOptimizationsUsed += Number(entry.optimizations_count || 0);
    currentPeriodAiMessagesUsed += Number(entry.ai_messages_count || 0);
    currentPeriodAiUsed += Number(entry.ai_tokens || 0);
  }

  let totalImports = 0;
  let totalAiCredits = 0;
  let totalCostUsd = 0;
  let totalWhisperSeconds = 0;
  let totalVisionImages = 0;
  const activeUsers = new Set<string>();
  const bySource = new Map<string, number>();
  const byModel = new Map<string, number>();
  const byModelCost = new Map<string, { aiCredits: number; costUsd: number; events: number }>();
  const actionTotals = new Map<string, { events: number; creditsUsed: number; costUsd: number }>();
  const contextTotals = new Map<string, { events: number; creditsUsed: number; costUsd: number }>();
  const actionModelBreakdown = new Map<
    string,
    { action: string; model: string; credits: number; costUsd: number; events: number }
  >();
  const importBreakdown = new Map<
    string,
    {
      requestId: string;
      ownerId: string | null;
      source: string | null;
      action: string;
      model: string;
      createdAt: string;
      credits: number;
      costUsd: number;
      events: number;
    }
  >();
  const dailyMap = new Map<string, { imports: number; aiCredits: number }>();
  const actionDailyCounts = new Map<string, Map<string, number>>();
  const actionDailyCredits = new Map<string, Map<string, number>>();
  const actionDailyCosts = new Map<string, Map<string, number>>();
  const sourceImportDaily = new Map<string, Map<string, number>>();
  const contextDailyCounts = new Map<string, Map<string, number>>();
  const costByUser = new Map<
    string,
    {
      ownerId: string;
      importCredits: number;
      gptMiniCredits: number;
      gpt4oCredits: number;
      visionImages: number;
      whisperSeconds: number;
      totalCostUsd: number;
    }
  >();

  for (const event of safeEvents) {
    if (event.owner_id) activeUsers.add(event.owner_id);
    const dayKey = toDayKey(new Date(event.created_at));
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { imports: 0, aiCredits: 0 });
    }
    const dayEntry = dailyMap.get(dayKey)!;

    const importCredits = Number(event.import_credits_used || 0);
    const aiCredits = Number(event.ai_credits_used || 0);
    const isImportCredit = event.event_type === "import_credit";
    const meta = typeof event.metadata === "object" && event.metadata ? event.metadata : null;
    const modelProvider = event.model_provider ?? "";
    const audioSeconds = meta ? Number((meta as Record<string, unknown>).audio_seconds || 0) : 0;
    const visionImages = meta ? Number((meta as Record<string, unknown>).images || 0) : 0;
    const usageUnits =
      modelProvider === "google-vision"
        ? visionImages
        : event.model_name === "whisper-1"
          ? audioSeconds
          : aiCredits;
    if (isImportCredit) {
      totalImports += importCredits;
    }
    totalAiCredits += aiCredits;
    totalCostUsd += Number(event.cost_usd || 0);
    if (modelProvider === "google-vision" && visionImages > 0) {
      totalVisionImages += visionImages;
    }

    if (isImportCredit) {
      dayEntry.imports += importCredits;
    }
    dayEntry.aiCredits += aiCredits;

    if (isImportCredit && importCredits > 0) {
      const key = event.source ?? "unknown";
      bySource.set(key, (bySource.get(key) ?? 0) + importCredits);
      if (!sourceImportDaily.has(key)) {
        sourceImportDaily.set(key, new Map());
      }
      sourceImportDaily.get(key)!.set(dayKey, (sourceImportDaily.get(key)!.get(dayKey) ?? 0) + importCredits);
    }
    if (usageUnits > 0) {
      const key = normalizeModelName(event.model_name);
      byModel.set(key, (byModel.get(key) ?? 0) + usageUnits);
    }

    const modelKey = normalizeModelName(event.model_name);
    const entry = byModelCost.get(modelKey) ?? { aiCredits: 0, costUsd: 0, events: 0 };
    entry.aiCredits += usageUnits;
    entry.costUsd += Number(event.cost_usd || 0);
    entry.events += 1;
    byModelCost.set(modelKey, entry);

    const actionKey = event.event_type ?? "unknown";
    const actionModelKey = `${actionKey}|${modelKey}`;
    const actionEntry = actionModelBreakdown.get(actionModelKey) ?? {
      action: actionKey,
      model: modelKey,
      credits: 0,
      costUsd: 0,
      events: 0,
    };
    actionEntry.credits += isImportCredit ? importCredits : usageUnits;
    actionEntry.costUsd += Number(event.cost_usd || 0);
    actionEntry.events += 1;
    actionModelBreakdown.set(actionModelKey, actionEntry);

    if (!actionDailyCounts.has(actionKey)) {
      actionDailyCounts.set(actionKey, new Map());
    }
    actionDailyCounts.get(actionKey)!.set(dayKey, (actionDailyCounts.get(actionKey)!.get(dayKey) ?? 0) + 1);

    const creditsForAction = isImportCredit ? importCredits : usageUnits;
    const actionTotalsEntry = actionTotals.get(actionKey) ?? {
      events: 0,
      creditsUsed: 0,
      costUsd: 0,
    };
    actionTotalsEntry.events += 1;
    actionTotalsEntry.creditsUsed += creditsForAction;
    actionTotalsEntry.costUsd += Number(event.cost_usd || 0);
    actionTotals.set(actionKey, actionTotalsEntry);

    const contextKey =
      typeof meta === "object" && meta && (meta as Record<string, unknown>).usage_context
        ? String((meta as Record<string, unknown>).usage_context)
        : actionKey === "import" || actionKey === "import_credit"
          ? "import"
          : actionKey === "scan"
            ? "scan"
            : actionKey === "manual_add"
              ? "manual"
              : "";
    if (contextKey) {
      const contextEntry = contextTotals.get(contextKey) ?? {
        events: 0,
        creditsUsed: 0,
        costUsd: 0,
      };
      contextEntry.events += 1;
      contextEntry.creditsUsed += creditsForAction;
      contextEntry.costUsd += Number(event.cost_usd || 0);
      contextTotals.set(contextKey, contextEntry);
    }
    if (!actionDailyCredits.has(actionKey)) {
      actionDailyCredits.set(actionKey, new Map());
    }
    actionDailyCredits.get(actionKey)!.set(dayKey, (actionDailyCredits.get(actionKey)!.get(dayKey) ?? 0) + creditsForAction);

    if (!actionDailyCosts.has(actionKey)) {
      actionDailyCosts.set(actionKey, new Map());
    }
    actionDailyCosts.get(actionKey)!.set(dayKey, (actionDailyCosts.get(actionKey)!.get(dayKey) ?? 0) + Number(event.cost_usd || 0));

    if (contextKey) {
      if (!contextDailyCounts.has(contextKey)) {
        contextDailyCounts.set(contextKey, new Map());
      }
      contextDailyCounts
        .get(contextKey)!
        .set(dayKey, (contextDailyCounts.get(contextKey)!.get(dayKey) ?? 0) + 1);
    }

    if (event.request_id && ["import", "scan", "import_credit"].includes(actionKey)) {
      const key = `${event.request_id}|${modelKey}|${actionKey}`;
      const entry = importBreakdown.get(key) ?? {
        requestId: event.request_id,
        ownerId: event.owner_id ?? null,
        source: event.source ?? null,
        action: actionKey,
        model: modelKey,
        createdAt: event.created_at,
        credits: 0,
        costUsd: 0,
        events: 0,
      };
      if (event.created_at < entry.createdAt) {
        entry.createdAt = event.created_at;
      }
      entry.credits += isImportCredit ? importCredits : usageUnits;
      entry.costUsd += Number(event.cost_usd || 0);
      entry.events += 1;
      importBreakdown.set(key, entry);
    }

    if (modelKey === "whisper-1" && audioSeconds > 0) {
      totalWhisperSeconds += audioSeconds;
    }

    if (event.owner_id) {
      const entry = costByUser.get(event.owner_id) ?? {
        ownerId: event.owner_id,
        importCredits: 0,
        gptMiniCredits: 0,
        gpt4oCredits: 0,
        visionImages: 0,
        whisperSeconds: 0,
        totalCostUsd: 0,
      };
      if (isImportCredit) {
        entry.importCredits += importCredits;
      }
      if (event.model_name === "gpt-4o-mini") {
        entry.gptMiniCredits += aiCredits;
      }
      if (event.model_name === "gpt-4o") {
        entry.gpt4oCredits += aiCredits;
      }
      if (modelProvider === "google-vision") {
        entry.visionImages += visionImages;
      }
      if (event.model_name === "whisper-1") {
        entry.whisperSeconds += audioSeconds;
      }
      entry.totalCostUsd += Number(event.cost_usd || 0);
      costByUser.set(event.owner_id, entry);
    }
  }

  const hasEventFilters = Boolean(
    email || userName || language || country || eventType || source || model || usageContext
  );
  if (safeEvents.length === 0 && safeMonthly.length > 0 && !hasEventFilters) {
    for (const entry of safeMonthly) {
      activeUsers.add(entry.owner_id);
      totalImports += Number(entry.import_count || 0);
      totalAiCredits += Number(entry.ai_tokens || 0);
      const key = normalizeDay(String(entry.period_start));
      dailyMap.set(key, {
        imports: Number(entry.import_count || 0),
        aiCredits: Number(entry.ai_tokens || 0),
      });
    }
    for (const row of safeMonthlyImports) {
      const key = row.source ?? "unknown";
      bySource.set(key, (bySource.get(key) ?? 0) + Number(row.import_count || 0));
    }
  }

  const dailySeries: UsageSummary["dailySeries"] = [];
  if (safeEvents.length > 0 || hasEventFilters) {
    for (let cursor = new Date(startDate); cursor <= endDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const key = toDayKey(cursor);
      const entry = dailyMap.get(key) ?? { imports: 0, aiCredits: 0 };
      dailySeries.push({ date: key, imports: entry.imports, aiCredits: entry.aiCredits });
    }
  } else {
    const monthlyKeys = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, entry] of monthlyKeys) {
      dailySeries.push({ date: key, imports: entry.imports, aiCredits: entry.aiCredits });
    }
  }

  if (dailySeries.length === 0) {
    for (let cursor = new Date(startDate); cursor <= endDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const key = toDayKey(cursor);
      dailySeries.push({ date: key, imports: 0, aiCredits: 0 });
    }
  }

  const buildSeries = (input: Map<string, Map<string, number>>) => {
    return Array.from(input.entries()).map(([label, values]) => ({
      label,
      points: dailySeries.map((day) => ({
        date: day.date,
        value: values.get(day.date) ?? 0,
      })),
    }));
  };

  const actionCountSeries = buildSeries(actionDailyCounts);
  const actionCreditSeries = buildSeries(actionDailyCredits);
  const actionCostSeries = buildSeries(actionDailyCosts);
  const sourceImportSeries = buildSeries(sourceImportDaily);
  const contextCountSeries = buildSeries(contextDailyCounts);

  const hasFilters = Boolean(userId || email || eventType || source || model || usageContext);
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map(
    (authData?.users ?? []).map((user) => [user.id, user.email ?? null])
  );
  const costByUserRows = Array.from(costByUser.values())
    .map((entry) => ({
      ownerId: entry.ownerId,
      email: emailById.get(entry.ownerId) ?? null,
      importCredits: entry.importCredits,
      gptMiniCredits: entry.gptMiniCredits,
      gpt4oCredits: entry.gpt4oCredits,
      visionImages: entry.visionImages,
      whisperSeconds: entry.whisperSeconds,
      totalCostUsd: Number(entry.totalCostUsd.toFixed(4)),
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  const addonPurchasedTotals = addonPurchases.reduce(
    (acc, row) => {
      const key = row.action_type;
      if (key === "import") acc.import += row.quantity;
      if (key === "translation") acc.translation += row.quantity;
      if (key === "optimization") acc.optimization += row.quantity;
      if (key === "ai_message") acc.ai_message += row.quantity;
      return acc;
    },
    { import: 0, translation: 0, optimization: 0, ai_message: 0 }
  );

  const creditInventory = [
    {
      action: "imports",
      planAvailable: totalPlanImportsAvailable,
      trialAvailable: totalTrialImportsRemaining,
      addonRemaining: totalAddonImportsRemaining,
      addonsPurchased: addonPurchases.length ? addonPurchasedTotals.import : null,
      addonsUsed: addonPurchases.length
        ? Math.max(addonPurchasedTotals.import - totalAddonImportsRemaining, 0)
        : null,
    },
    {
      action: "translations",
      planAvailable: totalPlanTranslationsAvailable,
      trialAvailable: totalTrialTranslationsRemaining,
      addonRemaining: totalAddonTranslationsRemaining,
      addonsPurchased: addonPurchases.length ? addonPurchasedTotals.translation : null,
      addonsUsed: addonPurchases.length
        ? Math.max(addonPurchasedTotals.translation - totalAddonTranslationsRemaining, 0)
        : null,
    },
    {
      action: "optimizations",
      planAvailable: totalPlanOptimizationsAvailable,
      trialAvailable: totalTrialOptimizationsRemaining,
      addonRemaining: totalAddonOptimizationsRemaining,
      addonsPurchased: addonPurchases.length ? addonPurchasedTotals.optimization : null,
      addonsUsed: addonPurchases.length
        ? Math.max(addonPurchasedTotals.optimization - totalAddonOptimizationsRemaining, 0)
        : null,
    },
    {
      action: "ai_messages",
      planAvailable: totalPlanAiMessagesAvailable,
      trialAvailable: totalTrialAiMessagesRemaining,
      addonRemaining: totalAddonAiMessagesRemaining,
      addonsPurchased: addonPurchases.length ? addonPurchasedTotals.ai_message : null,
      addonsUsed: addonPurchases.length
        ? Math.max(addonPurchasedTotals.ai_message - totalAddonAiMessagesRemaining, 0)
        : null,
    },
  ];

  const summary: UsageSummary = {
    totalUsers: hasFilters ? activeUsers.size : safeProfiles.length,
    baseUsers,
    premiumUsers,
    trialUsers,
    canceledUsers,
    canceledTrialUsers,
    baseMonthlyUsers,
    baseYearlyUsers,
    premiumMonthlyUsers,
    premiumYearlyUsers,
    freeUsers: trialUsers,
    usersByCountry: Array.from(usersByCountry.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    usersByLanguage: Array.from(usersByLanguage.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    actionTotals: Array.from(actionTotals.entries())
      .map(([action, values]) => ({
        action,
        events: values.events,
        creditsUsed: Number(values.creditsUsed.toFixed(2)),
        costUsd: Number(values.costUsd.toFixed(4)),
      }))
      .sort((a, b) => b.events - a.events),
    contextTotals: Array.from(contextTotals.entries())
      .map(([context, values]) => ({
        context,
        events: values.events,
        creditsUsed: Number(values.creditsUsed.toFixed(2)),
        costUsd: Number(values.costUsd.toFixed(4)),
      }))
      .sort((a, b) => b.events - a.events),
    creditInventory,
    totalImports,
    totalAiCredits,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    totalWhisperSeconds: Number(totalWhisperSeconds.toFixed(2)),
    totalVisionImages: Number(totalVisionImages.toFixed(2)),
    currentPeriodImportsUsed,
    currentPeriodTranslationsUsed,
    currentPeriodOptimizationsUsed,
    currentPeriodAiMessagesUsed,
    currentPeriodAiUsed,
    totalImportCreditsAvailable,
    totalTranslationCreditsAvailable,
    totalOptimizationCreditsAvailable,
    totalAiMessageCreditsAvailable,
    totalAiCreditsAvailable,
    activeUsers: activeUsers.size,
    dailySeries,
    bySource: Array.from(bySource.entries()).map(([label, value]) => ({ label, value })),
    byModel: Array.from(byModel.entries()).map(([label, value]) => ({ label, value })),
    modelBreakdown: Array.from(byModelCost.entries()).map(([label, entry]) => ({
      label,
      aiCredits: entry.aiCredits,
      costUsd: Number(entry.costUsd.toFixed(4)),
      events: entry.events,
    })),
    actionModelBreakdown: Array.from(actionModelBreakdown.values())
      .map((entry) => ({
        action: entry.action,
        model: entry.model,
        credits: entry.credits,
        costUsd: Number(entry.costUsd.toFixed(4)),
        events: entry.events,
      }))
      .sort((a, b) => b.credits - a.credits),
    importBreakdown: Array.from(importBreakdown.values())
      .map((entry) => ({
        requestId: entry.requestId,
        ownerId: entry.ownerId,
        source: entry.source,
        action: entry.action,
        model: entry.model,
        createdAt: entry.createdAt,
        credits: entry.credits,
        costUsd: Number(entry.costUsd.toFixed(4)),
        events: entry.events,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    sourceImportSeries,
    actionCountSeries,
    actionCreditSeries,
    actionCostSeries,
    contextCountSeries,
    costByUser: costByUserRows,
    actionSeries: actionCountSeries,
    sourceSeries: sourceImportSeries,
    contextSeries: contextCountSeries,
  };

  return NextResponse.json(summary);
}
