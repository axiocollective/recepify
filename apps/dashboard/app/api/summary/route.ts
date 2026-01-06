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
      "id, name, plan, subscription_period, trial_ends_at, bonus_imports, bonus_tokens, trial_imports, trial_tokens, trial_imports_used, trial_tokens_used"
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
    .select("owner_id, period_start, import_count, ai_tokens")
    .gte("period_start", startIso.slice(0, 10))
    .lte("period_start", endIso.slice(0, 10));
  let monthlyImportsQuery = supabaseAdmin
    .from("import_usage_monthly")
    .select("owner_id, source, import_count")
    .gte("period_start", startIso.slice(0, 10))
    .lte("period_start", endIso.slice(0, 10));

  if (email) {
    const ownerIds = await resolveOwnerIdsByEmail(email);
    if (ownerIds.length === 0) {
      return NextResponse.json({
        totalUsers: 0,
        baseUsers: 0,
        premiumUsers: 0,
        trialUsers: 0,
        baseMonthlyUsers: 0,
        baseYearlyUsers: 0,
        premiumMonthlyUsers: 0,
        premiumYearlyUsers: 0,
        freeUsers: 0,
        totalImports: 0,
        totalAiCredits: 0,
        totalCostUsd: 0,
        totalWhisperSeconds: 0,
        totalVisionImages: 0,
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
    profilesQuery = profilesQuery.in("id", ownerIds);
    eventsQuery = eventsQuery.in("owner_id", userId ? [userId] : ownerIds);
    monthlyQuery = monthlyQuery.in("owner_id", ownerIds);
    monthlyImportsQuery = monthlyImportsQuery.in("owner_id", ownerIds);
  }
  if (userId) {
    profilesQuery = profilesQuery.eq("id", userId);
    eventsQuery = eventsQuery.eq("owner_id", userId);
    monthlyQuery = monthlyQuery.eq("owner_id", userId);
    monthlyImportsQuery = monthlyImportsQuery.eq("owner_id", userId);
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
  ] = await Promise.all([profilesQuery, eventsQuery, monthlyQuery, monthlyImportsQuery]);

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

  const safeProfiles = (profiles ?? []) as ProfileRow[];
  const safeEvents = (events ?? []) as UsageEvent[];
  const safeMonthly = (monthlyUsage ?? []) as Array<{
    owner_id: string;
    period_start: string;
    import_count: number;
    ai_tokens: number;
  }>;
  const safeMonthlyImports = (monthlyImports ?? []) as Array<{
    owner_id?: string;
    source: string | null;
    import_count: number;
  }>;

  const now = Date.now();
  let baseUsers = 0;
  let premiumUsers = 0;
  let trialUsers = 0;
  let baseMonthlyUsers = 0;
  let baseYearlyUsers = 0;
  let premiumMonthlyUsers = 0;
  let premiumYearlyUsers = 0;
  safeProfiles.forEach((profile) => {
    const plan = profile.plan ?? "base";
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
    const trialEnds = profile.trial_ends_at ? Date.parse(profile.trial_ends_at) : null;
    if (trialEnds && trialEnds > now) {
      trialUsers += 1;
    }
  });

  let totalImports = 0;
  let totalAiCredits = 0;
  let totalCostUsd = 0;
  let totalWhisperSeconds = 0;
  let totalVisionImages = 0;
  const activeUsers = new Set<string>();
  const bySource = new Map<string, number>();
  const byModel = new Map<string, number>();
  const byModelCost = new Map<string, { aiCredits: number; costUsd: number; events: number }>();
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
    if (!actionDailyCredits.has(actionKey)) {
      actionDailyCredits.set(actionKey, new Map());
    }
    actionDailyCredits.get(actionKey)!.set(dayKey, (actionDailyCredits.get(actionKey)!.get(dayKey) ?? 0) + creditsForAction);

    if (!actionDailyCosts.has(actionKey)) {
      actionDailyCosts.set(actionKey, new Map());
    }
    actionDailyCosts.get(actionKey)!.set(dayKey, (actionDailyCosts.get(actionKey)!.get(dayKey) ?? 0) + Number(event.cost_usd || 0));

    if (event.metadata && typeof event.metadata === "object") {
      const contextKey = String((event.metadata as Record<string, unknown>).usage_context ?? "");
      if (contextKey) {
        if (!contextDailyCounts.has(contextKey)) {
          contextDailyCounts.set(contextKey, new Map());
        }
        contextDailyCounts.get(contextKey)!.set(dayKey, (contextDailyCounts.get(contextKey)!.get(dayKey) ?? 0) + 1);
      }
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

  const hasEventFilters = Boolean(email || eventType || source || model || usageContext);
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

  const summary: UsageSummary = {
    totalUsers: hasFilters ? activeUsers.size : safeProfiles.length,
    baseUsers,
    premiumUsers,
    trialUsers,
    baseMonthlyUsers,
    baseYearlyUsers,
    premiumMonthlyUsers,
    premiumYearlyUsers,
    freeUsers: trialUsers,
    totalImports,
    totalAiCredits,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    totalWhisperSeconds: Number(totalWhisperSeconds.toFixed(2)),
    totalVisionImages: Number(totalVisionImages.toFixed(2)),
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
