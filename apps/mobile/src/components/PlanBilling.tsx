import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PlanTier, UsageSummary } from "../data/types";
import { getPlanLimits } from "../data/usageLimits";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface PlanBillingProps {
  plan: PlanTier;
  usageSummary: UsageSummary | null;
  bonusImports?: number;
  bonusTokens?: number;
  subscriptionPeriod: "monthly" | "yearly";
  recipesCount: number;
  onPlanChange: (plan: PlanTier) => void;
  onBuyCredits: () => Promise<void>;
  onSubscriptionPeriodChange: (period: "monthly" | "yearly") => void;
  onBack: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
  allowPlanSwitchOverride?: boolean;
  variant?: "manage" | "onboarding";
}

const FREE_PLAN = {
  id: "free" as const,
  name: "Free Starter",
  price: "Free",
  subtitle: "Try Recepyfy",
  includes: [
    "5 recipe imports",
    "50k AI tokens",
    "All features included",
    "No payment required",
  ],
};

const getPaidPlanDetails = (billingPeriod: "yearly" | "monthly") => ({
  id: "paid" as const,
  name: "Subscription",
  price: billingPeriod === "yearly" ? "CHF 69 / year" : "CHF 7.90 / month",
  subtitle: billingPeriod === "yearly" ? "Best price overall" : "Best value for regular use",
  includes: [
    "40 recipe imports per month",
    "200k AI tokens per month",
    "All features included",
  ],
  note: billingPeriod === "yearly" ? "Save vs monthly" : "Lower cost per recipe",
});

export const PlanBilling: React.FC<PlanBillingProps> = ({
  plan,
  usageSummary,
  bonusImports = 0,
  bonusTokens = 0,
  subscriptionPeriod,
  recipesCount,
  onPlanChange,
  onBuyCredits,
  onSubscriptionPeriodChange,
  onBack,
  onContinue,
  continueLabel,
  title,
  allowPlanSwitchOverride,
  variant = "manage",
}) => {
  const isOnboarding = variant === "onboarding";
  const planLimits = useMemo(() => getPlanLimits(plan), [plan]);
  const usedImports = usageSummary?.importCount ?? 0;
  const usedTokens = usageSummary?.aiTokens ?? 0;
  const importLimit = planLimits.imports + bonusImports;
  const tokenLimit = planLimits.tokens + bonusTokens;
  const isSubscribed = plan === "paid" || plan === "premium";
  const importProgress = importLimit > 0 ? Math.min(1, usedImports / importLimit) : 0;
  const tokenProgress = tokenLimit > 0 ? Math.min(1, usedTokens / tokenLimit) : 0;
  const hasDevPlanSwitch = process.env.EXPO_PUBLIC_DEV_PLAN_SWITCH === "true";
  const [allowPlanSwitch, setAllowPlanSwitch] = useState(hasDevPlanSwitch);
  const canSwitchPlans = allowPlanSwitchOverride ?? allowPlanSwitch;
  const [selectedPlan, setSelectedPlan] = useState<"free" | "paid" | "credit_pack">("paid");
  const activeSelection = isOnboarding ? selectedPlan : plan;
  const [billingPeriod, setBillingPeriod] = useState<"yearly" | "monthly">(subscriptionPeriod);
  const paidPlan = getPaidPlanDetails(billingPeriod);

  React.useEffect(() => {
    setBillingPeriod(subscriptionPeriod);
  }, [subscriptionPeriod]);

  const formatNumber = (value: number) => value.toLocaleString("en-US");

  const openSubscriptionSettings = async () => {
    const url = "itms-apps://apps.apple.com/account/subscriptions";
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error("Subscriptions URL not supported");
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Unable to open subscriptions",
        "Please open the App Store and navigate to Account > Subscriptions."
      );
    }
  };

  const safePlanChange = async (nextPlan: PlanTier) => {
    try {
      await Promise.resolve(onPlanChange(nextPlan));
    } catch {
      Alert.alert("Plan update failed", "Please try again in a moment.");
    }
  };

  if (isOnboarding) {
    const onboardingPlans: Array<{
      id: "free" | "paid" | "credit_pack";
      name: string;
      price: string;
      period?: string;
      description: string;
      features: string[];
      popular?: boolean;
      note?: string;
    }> = [
      {
        id: "free",
        name: FREE_PLAN.name,
        price: FREE_PLAN.price,
        description: FREE_PLAN.subtitle,
        features: FREE_PLAN.includes,
      },
      {
        id: "paid",
        name: paidPlan.name,
        price: billingPeriod === "yearly" ? "CHF 69" : "CHF 7.90",
        period: billingPeriod === "yearly" ? "/ year" : "/ month",
        description: paidPlan.subtitle,
        features: paidPlan.includes,
        popular: true,
        note: paidPlan.note,
      },
      {
        id: "credit_pack",
        name: "Pay per Use",
        price: "CHF 6.90",
        period: "one-time",
        description: "No subscription",
        features: ["15 recipe imports", "75k AI tokens", "All features included", "Credits never expire"],
      },
    ];

    return (
      <SafeAreaView style={styles.onboardingScreen}>
        <View style={styles.onboardingHeader}>
          <Text style={styles.onboardingTitle}>{title ?? "Choose your plan"}</Text>
          <Text style={styles.onboardingSubtitle}>
            Pick the plan that fits you best. You can change this later.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.onboardingList}>
          {onboardingPlans.map((option) => {
            const isSelected = activeSelection === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedPlan(option.id)}
                style={({ pressed }) => [
                  styles.onboardingCard,
                  isSelected && styles.onboardingCardSelected,
                  option.popular && styles.onboardingCardPopular,
                  pressed && styles.onboardingCardPressed,
                ]}
              >
                {option.popular && (
                  <LinearGradient
                    colors={[colors.purple600, colors.purple500]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.popularBadge}
                  >
                    <Ionicons name="star" size={12} color={colors.white} />
                    <Text style={styles.popularBadgeText}>Most Popular</Text>
                  </LinearGradient>
                )}
                <View style={styles.onboardingHeaderRow}>
                  <View style={styles.planHeaderLeft}>
                    <Text style={styles.planName}>{option.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>{option.price}</Text>
                      {option.period && <Text style={styles.planPeriod}>{option.period}</Text>}
                    </View>
                  </View>
                  <View style={styles.planHeaderRight}>
                    {option.id === "paid" && (
                      <View style={styles.billingToggle}>
                      {(["yearly", "monthly"] as const).map((period) => (
                          <Pressable
                            key={period}
                            onPress={() => {
                              setBillingPeriod(period);
                              onSubscriptionPeriodChange(period);
                            }}
                            style={[styles.billingChip, billingPeriod === period && styles.billingChipActive]}
                          >
                            <Text style={[styles.billingChipText, billingPeriod === period && styles.billingChipTextActive]}>
                              {period === "yearly" ? "Yearly" : "Monthly"}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                    </View>
                  </View>
                </View>

                <Text style={styles.planDescription}>{option.description}</Text>
                {option.note && <Text style={styles.planNoteText}>{option.note}</Text>}
                <View style={styles.planFeatures}>
                  {option.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <View style={[styles.featureIcon, isSelected && styles.featureIconSelected]}>
                        <Ionicons
                          name="checkmark"
                          size={10}
                          color={isSelected ? colors.purple600 : colors.gray400}
                        />
                      </View>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.onboardingFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.onboardingCardPressed,
            ]}
            onPress={async () => {
              if (activeSelection === "paid") {
                await safePlanChange("paid");
              } else if (activeSelection === "free") {
                await safePlanChange("free");
              } else if (activeSelection === "credit_pack") {
                await onBuyCredits();
              }
              onContinue?.();
            }}
          >
            <Text style={styles.continueButtonText}>{continueLabel ?? "Continue"}</Text>
          </Pressable>
          <Text style={styles.footerHelper}>
            All features included
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>{title ?? "Plan & Usage"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isOnboarding && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Usage</Text>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="book-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statValue}>{recipesCount}</Text>
                <Text style={styles.statLabel}>Recipes saved</Text>
              </View>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="download-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statValue}>{formatNumber(usedImports)}</Text>
                <Text style={styles.statLabel}>
                  {isSubscribed
                    ? `of ${formatNumber(planLimits.imports)} monthly recipes${bonusImports > 0 ? ` + ${formatNumber(bonusImports)} extra` : ""}`
                    : `of ${formatNumber(importLimit)} total imports${bonusImports > 0 ? ` (includes ${formatNumber(bonusImports)} pay-per-use)` : ""}`}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${importProgress * 100}%` }]} />
                </View>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statValue}>{formatNumber(usedTokens)}</Text>
                <Text style={styles.statLabel}>
                  {plan === "ai_disabled"
                    ? "AI disabled on this plan"
                    : isSubscribed
                      ? `of ${formatNumber(planLimits.tokens)} monthly tokens${bonusTokens > 0 ? ` + ${formatNumber(bonusTokens)} extra` : ""}`
                      : `of ${formatNumber(tokenLimit)} total tokens${bonusTokens > 0 ? ` (includes ${formatNumber(bonusTokens)} pay-per-use)` : ""}`}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${tokenProgress * 100}%` }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Subscription</Text>
          <View style={styles.planList}>
            {[paidPlan].map((option) => {
              const isSelected = option.id === plan;
              const planRank = { ai_disabled: -1, free: 0, paid: 1, premium: 2 };
              const isDowngrade = planRank[option.id] < planRank[plan];
              const buttonLabel = isSelected
                ? "Current plan"
                : isDowngrade
                  ? "Downgrade"
                  : option.id === "free"
                    ? "Switch to Starter"
                    : "Upgrade";
              return (
                <View key={option.id} style={[styles.planCard, isSelected && styles.planCardSelected]}>
                  <View style={styles.planCardHeader}>
                    <View style={styles.planHeaderLeft}>
                      <Text style={[styles.planTitle, isSelected && styles.planTitleSelected]}>
                        {option.name}
                      </Text>
                      <Text style={styles.planPrice}>{option.price}</Text>
                    </View>
                    <View style={styles.planHeaderRight}>
                      {option.id === "paid" && (
                        <View style={styles.billingToggle}>
                          {(["yearly", "monthly"] as const).map((period) => (
                            <Pressable
                              key={period}
                              onPress={() => {
                                setBillingPeriod(period);
                                onSubscriptionPeriodChange(period);
                              }}
                              style={[styles.billingChip, billingPeriod === period && styles.billingChipActive]}
                            >
                              <Text style={[styles.billingChipText, billingPeriod === period && styles.billingChipTextActive]}>
                                {period === "yearly" ? "Yearly" : "Monthly"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.purple600} />}
                    </View>
                  </View>
                  <Text style={styles.planSubtitle}>{option.subtitle}</Text>
                  {option.id === "paid" && option.note && (
                    <Text style={styles.planNoteText}>{option.note}</Text>
                  )}
                  <View style={styles.planIncludes}>
                    {option.includes.map((item) => (
                      <View key={item} style={styles.planIncludeRow}>
                        <Ionicons name="checkmark" size={12} color={colors.gray500} />
                        <Text style={styles.planIncludeText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    style={[styles.planUpgradeButton, isSelected && styles.planUpgradeButtonDisabled]}
                    disabled={isSelected}
                    onPress={() => {
                      if (!canSwitchPlans) {
                        Alert.alert(
                          "Manage subscription",
                          "Plan changes are handled in the App Store.",
                          [{ text: "Open App Store", onPress: openSubscriptionSettings }, { text: "Close" }]
                        );
                        return;
                      }
                      if (isDowngrade) {
                        Alert.alert(
                          "Downgrade plan?",
                          "Downgrades take effect at the end of your current billing period.",
                          [
                            { text: "Keep current plan", style: "cancel" },
                            { text: "Continue", onPress: () => void safePlanChange(option.id) },
                          ]
                        );
                        return;
                      }
                      void safePlanChange(option.id);
                    }}
                  >
                    <Text style={[styles.planUpgradeText, isSelected && styles.planUpgradeTextDisabled]}>
                      {buttonLabel}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {plan === "paid" && (
            <Text style={styles.planNote}>
              Changes or cancellations apply at the end of your current billing period.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pay per Use</Text>
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <View>
                <Text style={styles.planTitle}>Pay per Use</Text>
                <Text style={styles.planPrice}>CHF 6.90 · one-time</Text>
              </View>
            </View>
            <Text style={styles.planSubtitle}>No subscription</Text>
            <View style={styles.planIncludes}>
              {["15 recipe imports", "75k AI tokens", "All features included", "Credits never expire"].map((item) => (
                <View key={item} style={styles.planIncludeRow}>
                  <Ionicons name="checkmark" size={12} color={colors.gray500} />
                  <Text style={styles.planIncludeText}>{item}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.planUpgradeButton}
              onPress={onBuyCredits}
            >
              <Text style={styles.planUpgradeText}>Buy credits</Text>
            </Pressable>
            <Text style={styles.planNote}>
              Pay per Use credits never expire and stack on top of your monthly limits.
            </Text>
          </View>
        </View>

        {!isOnboarding && hasDevPlanSwitch && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Developer</Text>
            <View style={styles.devToggle}>
              <View>
                <Text style={styles.devToggleTitle}>Local plan switching</Text>
                <Text style={styles.devToggleSubtitle}>Override App Store for testing.</Text>
              </View>
              <Switch value={allowPlanSwitch} onValueChange={setAllowPlanSwitch} />
            </View>
          </View>
        )}

        {onContinue && (
          <View style={styles.section}>
            <Pressable style={styles.continueButton} onPress={onContinue}>
              <Text style={styles.continueButtonText}>{continueLabel ?? "Continue"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
  },
  content: {
    paddingBottom: 120,
    paddingTop: spacing.lg,
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.gray500,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacing.lg,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.purple100,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    ...typography.h2,
    color: colors.gray900,
  },
  statLabel: {
    ...typography.caption,
    color: colors.gray500,
  },
  statBarTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    overflow: "hidden",
  },
  statBarFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
  },
  currentPlanCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  currentPlanHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  currentPlanLabel: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.gray500,
  },
  currentPlanName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.gray900,
  },
  currentPlanPrice: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray700,
  },
  currentPlanSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
  },
  currentPlanIncludes: {
    gap: spacing.xs,
  },
  currentPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  currentPlanItem: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  currentPlanActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  planActionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: "center",
    backgroundColor: colors.gray900,
  },
  planActionSecondary: {
    backgroundColor: colors.gray100,
  },
  planActionPrimaryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.white,
  },
  planActionSecondaryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.gray900,
  },
  planList: {
    gap: spacing.md,
  },
  planCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  planCardSelected: {
    borderColor: colors.purple600,
    backgroundColor: colors.purple100,
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planHeaderLeft: {
    flex: 1,
  },
  planHeaderRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  planTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  planTitleSelected: {
    color: colors.purple600,
  },
  planPrice: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    marginTop: 2,
  },
  planSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
  },
  planIncludes: {
    gap: spacing.xs,
  },
  planIncludeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  planIncludeText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  planUpgradeButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  planUpgradeButtonDisabled: {
    backgroundColor: colors.gray100,
  },
  planUpgradeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.white,
  },
  planUpgradeTextDisabled: {
    color: colors.gray500,
  },
  planNote: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray500,
    textAlign: "center",
  },
  continueButton: {
    minHeight: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray900,
    ...shadow.lg,
  },
  continueButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  onboardingScreen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  onboardingHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  onboardingTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700",
    color: colors.gray900,
  },
  onboardingSubtitle: {
    ...typography.body,
    color: colors.gray500,
  },
  onboardingList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  onboardingCard: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    padding: spacing.lg,
    minHeight: 44,
    gap: spacing.md,
  },
  onboardingCardSelected: {
    borderColor: colors.purple600,
    backgroundColor: "rgba(141, 74, 255, 0.08)",
    shadowColor: colors.purple600,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  onboardingCardPopular: {
    marginTop: spacing.lg,
  },
  onboardingCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: colors.purple600,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  popularBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  trialBadge: {
    position: "absolute",
    top: -12,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "#F97316",
    shadowColor: "#F97316",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  trialBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  onboardingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.gray900,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  planPrice: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.gray900,
  },
  planPeriod: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.gray300,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleSelected: {
    borderColor: colors.purple600,
    backgroundColor: colors.purple600,
  },
  planDescription: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray600,
  },
  planNoteText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  billingToggle: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 4,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  billingChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  billingChipActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  billingChipText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  billingChipTextActive: {
    color: colors.gray900,
    fontWeight: "600",
  },
  planFeatures: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  featureIcon: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconSelected: {
    backgroundColor: colors.purple100,
  },
  featureText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray700,
  },
  onboardingFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  trialHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    textAlign: "center",
  },
  footerHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray400,
    textAlign: "center",
  },
  devToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  devToggleTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  devToggleSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    marginTop: 4,
  },
});
