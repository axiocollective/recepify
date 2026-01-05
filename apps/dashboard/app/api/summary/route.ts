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

  const [{ data: profiles, error: profileError }, { data: events, error: eventsError }] =
    await Promise.all([
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
    ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const safeProfiles = (profiles ?? []) as ProfileRow[];
  const safeEvents = (events ?? []) as UsageEvent[];

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

  const dailySeries: UsageSummary["dailySeries"] = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const key = toDayKey(cursor);
    const entry = dailyMap.get(key) ?? { imports: 0, aiCredits: 0 };
    dailySeries.push({ date: key, imports: entry.imports, aiCredits: entry.aiCredits });
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
