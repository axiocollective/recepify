import { PlanTier, UsageSummary } from "./types";

const PLAN_LIMITS: Record<PlanTier, { imports: number; tokens: number }> = {
  ai_disabled: { imports: 0, tokens: 0 },
  free: { imports: 0, tokens: 0 },
  paid: { imports: 40, tokens: 200000 },
  premium: { imports: 200, tokens: 1000000 },
};

export const getPlanLimits = (plan: PlanTier) => PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

export const getEffectiveImportLimit = (plan: PlanTier, bonusImports = 0, trialImports = 0) => {
  const base = getPlanLimits(plan).imports + Math.max(0, bonusImports);
  if (plan === "free") {
    return base + Math.max(0, trialImports);
  }
  return base;
};

export const getEffectiveTokenLimit = (plan: PlanTier, bonusTokens = 0, trialTokens = 0) => {
  const base = getPlanLimits(plan).tokens + Math.max(0, bonusTokens);
  if (plan === "free") {
    return base + Math.max(0, trialTokens);
  }
  return base;
};

export const getImportLimitMessage = (plan: PlanTier, trialActive = false) => {
  if (plan === "paid" || plan === "premium") {
    return "You’ve run out of your monthly recipe imports. Buy additional credits or wait until your next billing period.";
  }
  return "You’ve run out of recipe imports. Buy additional credits or upgrade to Recepify Premium.";
};

export const getAiLimitMessage = (plan: PlanTier, trialActive = false) => {
  if (plan === "paid" || plan === "premium") {
    return "You’ve run out of your monthly AI credits. Buy additional credits or wait until your next billing period.";
  }
  return "You’ve run out of AI credits. Buy additional credits or upgrade to Recepify Premium.";
};

export const getImportLimitTitle = (plan: PlanTier) =>
  plan === "paid" || plan === "premium" ? "Monthly recipe imports used up" : "Recipe imports used up";

export const getAiLimitTitle = (plan: PlanTier) =>
  plan === "paid" || plan === "premium" ? "Monthly AI credits used up" : "AI credits used up";

export const isImportLimitReached = (
  plan: PlanTier,
  usage: UsageSummary | null,
  bonusImports = 0,
  trialImports = 0
) => {
  if (plan === "free") {
    return Math.max(0, bonusImports) + Math.max(0, trialImports) <= 0;
  }
  const limit = getEffectiveImportLimit(plan, bonusImports, trialImports);
  const used = usage?.importCount ?? 0;
  if (limit <= 0) return true;
  return used >= limit;
};

export const isAiLimitReached = (
  plan: PlanTier,
  usage: UsageSummary | null,
  bonusTokens = 0,
  trialTokens = 0
) => {
  if (plan === "free") {
    return Math.max(0, bonusTokens) + Math.max(0, trialTokens) <= 0;
  }
  const limit = getEffectiveTokenLimit(plan, bonusTokens, trialTokens);
  const used = usage?.aiTokens ?? 0;
  if (limit <= 0) return true;
  return used >= limit;
};
