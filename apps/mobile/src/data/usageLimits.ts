import { PlanTier, UsageSummary } from "./types";

const PLAN_LIMITS: Record<PlanTier, { imports: number; tokens: number }> = {
  ai_disabled: { imports: 0, tokens: 0 },
  free: { imports: 3, tokens: 15000 },
  paid: { imports: 50, tokens: 300000 },
  premium: { imports: 200, tokens: 1000000 },
};

export const getPlanLimits = (plan: PlanTier) => PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

export const isImportLimitReached = (plan: PlanTier, usage: UsageSummary | null) => {
  const limit = getPlanLimits(plan).imports;
  const used = usage?.importCount ?? 0;
  if (limit <= 0) return true;
  return used >= limit;
};

export const isAiLimitReached = (plan: PlanTier, usage: UsageSummary | null) => {
  const limit = getPlanLimits(plan).tokens;
  const used = usage?.aiTokens ?? 0;
  if (limit <= 0) return true;
  return used >= limit;
};
