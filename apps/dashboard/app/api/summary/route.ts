import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { ProfileRow, UsageEvent, UsageSummary } from "../../lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

const getDateRange = (start?: string | null, end?: string | null) => {
  const endDate = parseDate(end) ?? new Date();
  const startDate = parseDate(start) ?? new Date(endDate.getTime() - 29 * DAY_MS);
  return { startDate, endDate };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { startDate, endDate } = getDateRange(
    searchParams.get("start"),
    searchParams.get("end")
  );
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const [
    { data: profiles, error: profileError },
    { data: events, error: eventsError },
    { data: monthlyUsage, error: monthlyError },
    { data: monthlyImports, error: monthlyImportsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, name, plan, subscription_period, trial_ends_at, bonus_imports, bonus_tokens, trial_imports, trial_tokens, trial_imports_used, trial_tokens_used"
      ),
    supabaseAdmin
      .from("usage_events")
      .select(
        "owner_id, event_type, source, model_name, ai_credits_used, import_credits_used, cost_usd, created_at"
      )
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabaseAdmin
      .from("usage_monthly")
      .select("owner_id, period_start, import_count, ai_tokens")
      .gte("period_start", startIso.slice(0, 10))
      .lte("period_start", endIso.slice(0, 10)),
    supabaseAdmin
      .from("import_usage_monthly")
      .select("source, import_count")
      .gte("period_start", startIso.slice(0, 10))
      .lte("period_start", endIso.slice(0, 10)),
  ]);

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
    source: string | null;
    import_count: number;
  }>;

  const now = Date.now();
  let baseUsers = 0;
  let premiumUsers = 0;
  let trialUsers = 0;
  safeProfiles.forEach((profile) => {
    const plan = profile.plan ?? "base";
    if (plan === "premium") {
      premiumUsers += 1;
    } else {
      baseUsers += 1;
    }
    const trialEnds = profile.trial_ends_at ? Date.parse(profile.trial_ends_at) : null;
    if (trialEnds && trialEnds > now) {
      trialUsers += 1;
    }
  });

  let totalImports = 0;
  let totalAiCredits = 0;
  let totalCostUsd = 0;
  const activeUsers = new Set<string>();
  const bySource = new Map<string, number>();
  const byModel = new Map<string, number>();
  const dailyMap = new Map<string, { imports: number; aiCredits: number }>();

  for (const event of safeEvents) {
    if (event.owner_id) activeUsers.add(event.owner_id);
    const dayKey = toDayKey(new Date(event.created_at));
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { imports: 0, aiCredits: 0 });
    }
    const dayEntry = dailyMap.get(dayKey)!;

    const importCredits = Number(event.import_credits_used || 0);
    const aiCredits = Number(event.ai_credits_used || 0);
    totalImports += importCredits;
    totalAiCredits += aiCredits;
    totalCostUsd += Number(event.cost_usd || 0);

    dayEntry.imports += importCredits;
    dayEntry.aiCredits += aiCredits;

    if (importCredits > 0) {
      const key = event.source ?? "unknown";
      bySource.set(key, (bySource.get(key) ?? 0) + importCredits);
    }
    if (aiCredits > 0) {
      const key = event.model_name ?? "unknown";
      byModel.set(key, (byModel.get(key) ?? 0) + aiCredits);
    }
  }

  if (safeEvents.length === 0 && safeMonthly.length > 0) {
    for (const entry of safeMonthly) {
      activeUsers.add(entry.owner_id);
      totalImports += Number(entry.import_count || 0);
      totalAiCredits += Number(entry.ai_tokens || 0);
      const key = String(entry.period_start);
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
  if (safeEvents.length > 0) {
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

  const summary: UsageSummary = {
    totalUsers: safeProfiles.length,
    baseUsers,
    premiumUsers,
    trialUsers,
    totalImports,
    totalAiCredits,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    activeUsers: activeUsers.size,
    dailySeries,
    bySource: Array.from(bySource.entries()).map(([label, value]) => ({ label, value })),
    byModel: Array.from(byModel.entries()).map(([label, value]) => ({ label, value })),
  };

  return NextResponse.json(summary);
}
