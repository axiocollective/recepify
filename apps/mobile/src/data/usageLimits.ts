import { PlanTier, UsageSummary } from "./types";

type PlanActionLimits = {
  imports: number;
  translations: number;
  optimizations: number;
  aiMessages: number;
};

const PLAN_LIMITS: Record<PlanTier, PlanActionLimits> = {
  ai_disabled: { imports: 0, translations: 0, optimizations: 0, aiMessages: 0 },
  base: { imports: 0, translations: 0, optimizations: 0, aiMessages: 0 },
  premium: { imports: 25, translations: 25, optimizations: 25, aiMessages: 150 },
};

export const getPlanLimits = (plan: PlanTier): PlanActionLimits => PLAN_LIMITS[plan] ?? PLAN_LIMITS.base;

const available = (planAmount: number, addon: number, trial: number, plan: PlanTier, trialActive: boolean) => {
  const base = Math.max(0, planAmount) + Math.max(0, addon);
  if (plan === "base" && trialActive) {
    return base + Math.max(0, trial);
  }
  return base;
};

export const getAvailableImports = (
  plan: PlanTier,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => available(getPlanLimits(plan).imports, addons, trial, plan, trialActive);

export const getAvailableTranslations = (
  plan: PlanTier,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => available(getPlanLimits(plan).translations, addons, trial, plan, trialActive);

export const getAvailableOptimizations = (
  plan: PlanTier,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => available(getPlanLimits(plan).optimizations, addons, trial, plan, trialActive);

export const getAvailableAiMessages = (
  plan: PlanTier,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => available(getPlanLimits(plan).aiMessages, addons, trial, plan, trialActive);

export const isImportLimitReached = (
  plan: PlanTier,
  usage: UsageSummary | null,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => {
  const limit = getAvailableImports(plan, trialActive, addons, trial);
  const used = usage?.importCount ?? 0;
  return limit <= 0 || used >= limit;
};

export const isTranslationLimitReached = (
  plan: PlanTier,
  usage: UsageSummary | null,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => {
  const limit = getAvailableTranslations(plan, trialActive, addons, trial);
  const used = usage?.translationCount ?? 0;
  return limit <= 0 || used >= limit;
};

export const isOptimizationLimitReached = (
  plan: PlanTier,
  usage: UsageSummary | null,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => {
  const limit = getAvailableOptimizations(plan, trialActive, addons, trial);
  const used = usage?.optimizationCount ?? 0;
  return limit <= 0 || used >= limit;
};

export const isAiLimitReached = (
  plan: PlanTier,
  usage: UsageSummary | null,
  trialActive: boolean,
  addons = 0,
  trial = 0
) => {
  const limit = getAvailableAiMessages(plan, trialActive, addons, trial);
  const used = usage?.aiMessagesCount ?? 0;
  return limit <= 0 || used >= limit;
};

export const getImportLimitMessage = (plan: PlanTier) =>
  plan === "premium"
    ? "You’ve run out of your monthly recipe imports. Buy more or wait until your next period."
    : "You’ve run out of recipe imports. Buy more or upgrade to Premium.";

export const getTranslationLimitMessage = (plan: PlanTier) =>
  plan === "premium"
    ? "You’ve run out of your monthly translations. Buy more or wait until your next period."
    : "You’ve run out of translations. Buy more or upgrade to Premium.";

export const getOptimizationLimitMessage = (plan: PlanTier) =>
  plan === "premium"
    ? "You’ve run out of your monthly optimizations. Buy more or wait until your next period."
    : "You’ve run out of optimizations. Buy more or upgrade to Premium.";

export const getAiLimitMessage = (plan: PlanTier) =>
  plan === "premium"
    ? "You’ve run out of your monthly AI assistant messages. Buy more or wait until your next period."
    : "You’ve run out of AI assistant messages. Buy more or upgrade to Premium.";

export const getImportLimitTitle = (plan: PlanTier) =>
  plan === "premium" ? "Monthly recipe imports used up" : "Recipe imports used up";

export const getAiLimitTitle = (plan: PlanTier) =>
  plan === "premium" ? "Monthly AI messages used up" : "AI messages used up";
