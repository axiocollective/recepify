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
  recipesCount: number;
  onPlanChange: (plan: PlanTier) => void;
  onBack: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
  allowPlanSwitchOverride?: boolean;
  variant?: "manage" | "onboarding";
}

const PLAN_OPTIONS: Array<{
  id: PlanTier;
  name: string;
  price: string;
  subtitle: string;
  includes: string[];
}> = [
  {
    id: "free",
    name: "Starter",
    price: "Free",
    subtitle: "Great for trying Recipefy.",
    includes: ["3 recipe imports / month", "15k AI tokens / month", "Collections + favorites"],
  },
  {
    id: "paid",
    name: "Sous-Chef",
    price: "CHF 7.90 / month",
    subtitle: "CHF 79 / year billed annually.",
    includes: ["40 recipe imports / month", "200k AI tokens / month", "Collections + favorites"],
  },
];

export const PlanBilling: React.FC<PlanBillingProps> = ({
  plan,
  usageSummary,
  recipesCount,
  onPlanChange,
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
  const importLimit = planLimits.imports;
  const tokenLimit = planLimits.tokens;
  const importProgress = importLimit > 0 ? Math.min(1, usedImports / importLimit) : 0;
  const tokenProgress = tokenLimit > 0 ? Math.min(1, usedTokens / tokenLimit) : 0;
  const hasDevPlanSwitch = process.env.EXPO_PUBLIC_DEV_PLAN_SWITCH === "true";
  const [allowPlanSwitch, setAllowPlanSwitch] = useState(hasDevPlanSwitch);
  const canSwitchPlans = allowPlanSwitchOverride ?? allowPlanSwitch;
  const [selectedPlan, setSelectedPlan] = useState<"paid" | "credit_pack">("paid");
  const activeSelection = isOnboarding ? selectedPlan : plan;

  const activePlan =
    plan === "ai_disabled"
      ? {
          id: "ai_disabled" as PlanTier,
          name: "AI Disabled",
          price: "Free",
          subtitle: "AI features are turned off on this plan.",
          includes: ["No AI usage", "Core recipe features only"],
        }
      : PLAN_OPTIONS.find((option) => option.id === plan) ?? PLAN_OPTIONS[0];

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
      id: "paid" | "credit_pack";
      name: string;
      price: string;
      period?: string;
      description: string;
      features: string[];
      popular?: boolean;
      trial?: string;
      note?: string;
    }> = [
      {
        id: "paid",
        name: "Sous-Chef",
        price: "CHF 7.90",
        period: "/ month",
        description: "Serious cooking, bigger limits.",
        features: ["40 recipe imports / month", "200k AI tokens / month", "Collections + favorites"],
        popular: true,
        trial: "7 days free",
        note: "CHF 79 / year billed annually.",
      },
      {
        id: "credit_pack",
        name: "Credit Pack",
        price: "CHF 6.90",
        period: "one-time",
        description: "Buy credits, no expiry.",
        features: ["20 recipe imports", "100k AI tokens", "Credits never expire"],
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
                {option.trial && (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialBadgeText}>{option.trial.toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.onboardingHeaderRow}>
                  <View>
                    <Text style={styles.planName}>{option.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>{option.price}</Text>
                      {option.period && <Text style={styles.planPeriod}>{option.period}</Text>}
                    </View>
                  </View>
                  <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
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
              }
              onContinue?.();
            }}
          >
            <Text style={styles.continueButtonText}>{continueLabel ?? "Continue"}</Text>
          </Pressable>
          {activeSelection === "paid" && (
            <Text style={styles.trialHelper}>Start your free 7-day trial. Cancel anytime.</Text>
          )}
          <Text style={styles.footerHelper}>
            All plans include Collections, Favorites & AI Import
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
                <Text style={styles.statLabel}>of {formatNumber(importLimit)} monthly imports</Text>
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
                    : `of ${formatNumber(tokenLimit)} monthly tokens`}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${tokenProgress * 100}%` }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        {!isOnboarding && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Current plan</Text>
            <View style={styles.currentPlanCard}>
              <View style={styles.currentPlanHeader}>
                <View>
                  <Text style={styles.currentPlanLabel}>Active</Text>
                  <Text style={styles.currentPlanName}>{activePlan.name}</Text>
                </View>
                <Text style={styles.currentPlanPrice}>{activePlan.price}</Text>
              </View>
              <Text style={styles.currentPlanSubtitle}>{activePlan.subtitle}</Text>
              <View style={styles.currentPlanIncludes}>
                {activePlan.includes.map((item) => (
                  <View key={item} style={styles.currentPlanRow}>
                    <Ionicons name="checkmark" size={14} color={colors.purple600} />
                    <Text style={styles.currentPlanItem}>{item}</Text>
                  </View>
                ))}
              </View>
              {(plan === "paid" || plan === "premium") && (
                <View style={styles.currentPlanActions}>
                  <Pressable style={[styles.planActionButton, styles.planActionSecondary]} onPress={openSubscriptionSettings}>
                    <Text style={styles.planActionSecondaryText}>Manage</Text>
                  </Pressable>
                  <Pressable style={styles.planActionButton} onPress={openSubscriptionSettings}>
                    <Text style={styles.planActionPrimaryText}>Cancel plan</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Subscription</Text>
          <View style={styles.planList}>
            {PLAN_OPTIONS.map((option) => {
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
                    <View>
                      <Text style={[styles.planTitle, isSelected && styles.planTitleSelected]}>
                        {option.name}
                      </Text>
                      <Text style={styles.planPrice}>{option.price}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.purple600} />}
                  </View>
                  <Text style={styles.planSubtitle}>{option.subtitle}</Text>
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
          <Text style={styles.sectionLabel}>Pay as you go</Text>
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <View>
                <Text style={styles.planTitle}>Credit Pack</Text>
                <Text style={styles.planPrice}>CHF 6.90</Text>
              </View>
            </View>
            <Text style={styles.planSubtitle}>One-time purchase. Credits never expire.</Text>
            <View style={styles.planIncludes}>
              {["20 recipe imports", "100k AI tokens"].map((item) => (
                <View key={item} style={styles.planIncludeRow}>
                  <Ionicons name="checkmark" size={12} color={colors.gray500} />
                  <Text style={styles.planIncludeText}>{item}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.planUpgradeButton}
              onPress={() =>
                Alert.alert("Buy credits", "Purchases will be available once App Store billing is set up.")
              }
            >
              <Text style={styles.planUpgradeText}>Buy credits</Text>
            </Pressable>
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
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
