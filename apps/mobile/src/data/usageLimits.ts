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
    return "You’ve reached your monthly recipe import limit. Buy extra credits in the Subscription section. Monthly credits reset automatically.";
  }
  if (trialActive) {
    return "Your free trial imports are used up. Buy extra credits in the Subscription section to keep importing.";
  }
  return "Your free trial has ended. Recepify Base is active, but imports require extra credits from the Subscription section.";
};

export const getAiLimitMessage = (plan: PlanTier, trialActive = false) => {
  if (plan === "paid" || plan === "premium") {
    return "You’ve used all your AI credits for this month. You can buy extra credits in the Subscription section.";
  }
  if (trialActive) {
    return "Your free trial AI credits are used up. Buy extra credits in the Subscription section to keep using AI.";
  }
  return "Your free trial has ended. Recepify Base is active, but AI requires extra credits from the Subscription section.";
};

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
