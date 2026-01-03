import { PlanTier, UsageSummary } from "./types";

const PLAN_LIMITS: Record<PlanTier, { imports: number; tokens: number }> = {
  ai_disabled: { imports: 0, tokens: 0 },
  free: { imports: 5, tokens: 50000 },
  paid: { imports: 40, tokens: 200000 },
  premium: { imports: 200, tokens: 1000000 },
};

export const getPlanLimits = (plan: PlanTier) => PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

export const getEffectiveImportLimit = (plan: PlanTier, bonusImports = 0) =>
  getPlanLimits(plan).imports + Math.max(0, bonusImports);

export const getEffectiveTokenLimit = (plan: PlanTier, bonusTokens = 0) =>
  getPlanLimits(plan).tokens + Math.max(0, bonusTokens);

export const getImportLimitMessage = (plan: PlanTier) => {
  if (plan === "paid" || plan === "premium") {
    return "You’ve used all monthly import credits. Buy Pay per Use credits to keep importing.";
  }
  return "You’ve used all monthly import credits. Upgrade to Subscription or buy Pay per Use credits.";
};

export const getAiLimitMessage = (plan: PlanTier) => {
  if (plan === "paid" || plan === "premium") {
    return "You’ve used all monthly AI credits. Buy Pay per Use credits to continue.";
  }
  return "You’ve used all monthly AI credits. Upgrade to Subscription or buy Pay per Use credits.";
};

export const isImportLimitReached = (plan: PlanTier, usage: UsageSummary | null, bonusImports = 0) => {
  const limit = getEffectiveImportLimit(plan, bonusImports);
  const used = usage?.importCount ?? 0;
  if (limit <= 0) return true;
  return used >= limit;
};

export const isAiLimitReached = (plan: PlanTier, usage: UsageSummary | null, bonusTokens = 0) => {
  const limit = getEffectiveTokenLimit(plan, bonusTokens);
  const used = usage?.aiTokens ?? 0;
  if (limit <= 0) return true;
  return used >= limit;
};
