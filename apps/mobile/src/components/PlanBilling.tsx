import React, { useMemo, useState } from "react";
import { Alert, Dimensions, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlanTier, UsageSummary } from "../data/types";
import { getPlanLimits } from "../data/usageLimits";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface PlanBillingProps {
  plan: PlanTier;
  usageSummary: UsageSummary | null;
  addonImports?: number;
  addonTranslations?: number;
  addonOptimizations?: number;
  addonAiMessages?: number;
  trialActive?: boolean;
  trialEndsAt?: string | null;
  trialCanceledAt?: string | null;
  trialImportsRemaining?: number;
  trialTranslationsRemaining?: number;
  trialOptimizationsRemaining?: number;
  trialAiMessagesRemaining?: number;
  subscriptionEndsAt?: string | null;
  subscriptionStatus?: "active" | "canceled" | "expired";
  focusSection?: "credits" | null;
  subscriptionPeriod: "monthly" | "yearly";
  recipesCount: number;
  onPlanChange: (plan: PlanTier) => void;
  onBuyCredits: (action: "import" | "translation" | "optimization" | "ai_message", quantity: number) => Promise<void>;
  onSubscriptionPeriodChange: (period: "monthly" | "yearly") => void;
  onCancelSubscription?: (endsAt: string) => void;
  onCancelTrial?: () => void;
  onBack: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
  allowPlanSwitchOverride?: boolean;
  variant?: "manage" | "onboarding";
}

const BASE_PLAN = {
  id: "base" as const,
  name: "Recipefy Base",
  price: "CHF 15 / year",
  subtitle: "Your personal recipe library",
  includes: [
    "Add recipes manually",
    "Access all recipes",
    "Collections & favorites",
    "Cooking mode",
    "Shopping list",
  ],
};

const getPaidPlanDetails = (billingPeriod: "yearly" | "monthly") => ({
  id: "premium" as const,
  name: "Recipefy Premium",
  price: billingPeriod === "yearly" ? "CHF 69 / year" : "CHF 6.90 / month",
  subtitle: billingPeriod === "yearly" ? "Best price overall" : "Most flexible",
  includes: [
    "25 recipe imports per period",
    "25 recipe translations per period",
    "25 recipe optimizations per period",
    "150 AI assistant messages per period",
  ],
  note: billingPeriod === "yearly" ? "Save vs monthly" : "Lower cost per recipe",
});

export const PlanBilling: React.FC<PlanBillingProps> = ({
  plan,
  usageSummary,
  addonImports = 0,
  addonTranslations = 0,
  addonOptimizations = 0,
  addonAiMessages = 0,
  trialActive = false,
  trialEndsAt = null,
  trialCanceledAt = null,
  trialImportsRemaining = 0,
  trialTranslationsRemaining = 0,
  trialOptimizationsRemaining = 0,
  trialAiMessagesRemaining = 0,
  subscriptionEndsAt = null,
  subscriptionStatus = "active",
  focusSection = null,
  subscriptionPeriod,
  recipesCount,
  onPlanChange,
  onBuyCredits,
  onSubscriptionPeriodChange,
  onCancelSubscription,
  onCancelTrial,
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
  const usedTranslations = usageSummary?.translationCount ?? 0;
  const usedOptimizations = usageSummary?.optimizationCount ?? 0;
  const usedAiMessages = usageSummary?.aiMessagesCount ?? 0;
  const importLimit = planLimits.imports + addonImports + (plan === "base" ? trialImportsRemaining : 0);
  const translationLimit = planLimits.translations + addonTranslations + (plan === "base" ? trialTranslationsRemaining : 0);
  const optimizationLimit = planLimits.optimizations + addonOptimizations + (plan === "base" ? trialOptimizationsRemaining : 0);
  const aiMessageLimit = planLimits.aiMessages + addonAiMessages + (plan === "base" ? trialAiMessagesRemaining : 0);
  const isSubscribed = plan === "premium";
  const planLabel = plan === "premium" ? "Recipefy Premium" : "Recipefy Base";
  const importProgress =
    importLimit > 0 ? Math.min(1, usedImports / importLimit) : usedImports > 0 ? 1 : 0;
  const translationProgress =
    translationLimit > 0 ? Math.min(1, usedTranslations / translationLimit) : usedTranslations > 0 ? 1 : 0;
  const optimizationProgress =
    optimizationLimit > 0 ? Math.min(1, usedOptimizations / optimizationLimit) : usedOptimizations > 0 ? 1 : 0;
  const aiMessageProgress =
    aiMessageLimit > 0 ? Math.min(1, usedAiMessages / aiMessageLimit) : usedAiMessages > 0 ? 1 : 0;
  const hasDevPlanSwitch = process.env.EXPO_PUBLIC_DEV_PLAN_SWITCH === "true";
  const canSwitchPlans = allowPlanSwitchOverride ?? hasDevPlanSwitch;
  const [selectedPlan, setSelectedPlan] = useState<"base" | "premium">("base");
  const activeSelection = isOnboarding ? selectedPlan : plan;
  const [billingPeriod, setBillingPeriod] = useState<"yearly" | "monthly">(subscriptionPeriod);
  const [showPlanOptions, setShowPlanOptions] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<"base" | "subscription">(isSubscribed ? "subscription" : "base");
  const [pendingSubscriptionBilling, setPendingSubscriptionBilling] =
    useState<"yearly" | "monthly">(subscriptionPeriod);
  const [pendingBaseBilling, setPendingBaseBilling] = useState<"yearly" | "monthly">("yearly");
  const paidPlan = getPaidPlanDetails(billingPeriod);
  const formatEndDate = (value: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const handleCancelPress = () => {
    const now = new Date();
    const parsedTrialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
    const hasValidTrialEnd =
      trialActive && parsedTrialEnd && !Number.isNaN(parsedTrialEnd.getTime()) && parsedTrialEnd > now;
    const parsedEnd = subscriptionEndsAt ? new Date(subscriptionEndsAt) : null;
    const hasValidEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) && parsedEnd > now;
    const endDate = hasValidTrialEnd
      ? parsedTrialEnd!
      : hasValidEnd
        ? parsedEnd!
        : (() => {
            const next = new Date(now);
            if (subscriptionPeriod === "monthly") {
              next.setMonth(next.getMonth() + 1);
            } else {
              next.setFullYear(next.getFullYear() + 1);
            }
            return next;
          })();
    const formattedEnd = formatEndDate(endDate.toISOString());
    Alert.alert(
      "Cancel subscription?",
      `Your plan will end on ${formattedEnd}. You'll be logged out after that date and lose access to your library. Your recipes stay saved and will be available if you sign in again. (${planLabel})`,
      [
        { text: "Keep subscription", style: "cancel" },
        {
          text: "Cancel subscription",
          style: "destructive",
          onPress: () => onCancelSubscription?.(endDate.toISOString()),
        },
      ]
    );
  };
  const handleCancelTrialPress = () => {
    const formattedEnd = formatEndDate(trialEndsAt);
    Alert.alert(
      "Cancel trial?",
      `Your trial will remain active until ${formattedEnd}. You won't be subscribed after the trial ends.`,
      [
        { text: "Keep trial", style: "cancel" },
        {
          text: "Cancel trial",
          style: "destructive",
          onPress: () => onCancelTrial?.(),
        },
      ]
    );
  };
  const trialCancelLabel = trialEndsAt ? formatEndDate(trialEndsAt) : null;
  const trialCancelText = trialCanceledAt && trialCancelLabel
    ? `Trial ends ${trialCancelLabel}`
    : `Cancel trial${trialCancelLabel ? ` (ends ${trialCancelLabel})` : ""}`;
  const canceledLabel = subscriptionStatus === "canceled" ? formatEndDate(subscriptionEndsAt) : null;
  const creditsSectionLayout = React.useRef<{ y: number; height: number } | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const screenHeight = Dimensions.get("window").height;

  const scrollToCredits = () => {
    if (!creditsSectionLayout.current) return;
    const { y, height } = creditsSectionLayout.current;
    const target = Math.max(y - (screenHeight / 2 - height / 2), 0);
    scrollRef.current?.scrollTo({
      y: target,
      animated: true,
    });
  };

  React.useEffect(() => {
    if (focusSection !== "credits") return;
    const timeout = setTimeout(() => {
      scrollToCredits();
    }, 50);
    return () => clearTimeout(timeout);
  }, [focusSection]);

  React.useEffect(() => {
    setBillingPeriod(subscriptionPeriod);
  }, [subscriptionPeriod]);

  React.useEffect(() => {
    if (showPlanOptions) return;
    setPendingPlan(isSubscribed ? "subscription" : "base");
    setPendingSubscriptionBilling(subscriptionPeriod);
    setPendingBaseBilling(isSubscribed ? "yearly" : subscriptionPeriod);
  }, [isSubscribed, showPlanOptions, subscriptionPeriod]);


  const formatNumber = (value: number) => value.toLocaleString("en-US");
  const formatUsageLabel = (used: number, monthly: number, extra: number, trial: number) => {
    const parts: string[] = [];
    parts.push(`${formatNumber(used)} used`);
    if (monthly > 0) {
      parts.push(`${formatNumber(monthly)} monthly`);
    }
    if (trial > 0) {
      parts.push(`${formatNumber(trial)} trial`);
    }
    if (extra > 0) {
      parts.push(`${formatNumber(extra)} extra`);
    }
    return parts.join(" · ");
  };
  const currentSubscriptionPrice =
    subscriptionPeriod === "yearly" ? "CHF 69 / year" : "CHF 6.90 / month";
  const currentBasePrice =
    subscriptionPeriod === "yearly" ? "CHF 15 / year" : "CHF 1.50 / month";
  const pendingSubscriptionPrice =
    pendingSubscriptionBilling === "yearly" ? "CHF 69 / year" : "CHF 6.90 / month";
  const pendingBasePrice =
    pendingBaseBilling === "yearly" ? "CHF 15 / year" : "CHF 1.50 / month";
  const pendingBaseAlt =
    pendingBaseBilling === "yearly" ? "or CHF 1.50 / month" : "or CHF 15 / year";
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const addonOptions = [
    {
      action: "import" as const,
      title: "+15 recipe imports",
      price: "CHF 5",
      description: "Never expire",
      quantity: 15,
    },
    {
      action: "translation" as const,
      title: "+15 recipe translations",
      price: "CHF 4",
      description: "Never expire",
      quantity: 15,
    },
    {
      action: "optimization" as const,
      title: "+15 recipe optimizations",
      price: "CHF 4",
      description: "Never expire",
      quantity: 15,
    },
    {
      action: "ai_message" as const,
      title: "+100 AI assistant messages",
      price: "CHF 5",
      description: "Never expire",
      quantity: 100,
    },
  ];

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

  const confirmAddonPurchase = (option: typeof addonOptions[number]) => {
    Alert.alert(
      "Confirm purchase",
      `Buy ${option.title} for ${option.price}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy",
          onPress: async () => {
            try {
              await onBuyCredits(option.action, option.quantity);
            } catch {
              Alert.alert("Purchase failed", "Please try again in a moment.");
            }
          },
        },
      ]
    );
  };

  if (isOnboarding) {
    const isYearly = billingPeriod === "yearly";
    const trialBadge = "14 DAYS FREE";
    const premiumBadge = "MOST POPULAR";
    const basePrice = isYearly ? "CHF 15" : "CHF 1.50";
    const premiumPrice = isYearly ? "CHF 69" : "CHF 8";
    const periodLabel = isYearly ? "year" : "month";
    const trialFeatures = [
      "10 imports",
      "10 AI translations",
      "10 AI optimizations",
      "50 AI assistant messages",
    ];
    const premiumFeatures = [
      `25 imports/${periodLabel}`,
      "25 AI translations",
      "25 AI optimizations",
      "150 AI assistant messages",
      "Everything from Base included",
    ];
    const renderToggle = (onPress?: () => void) => (
      <View style={styles.onboardingToggle}>
        {(["yearly", "monthly"] as const).map((period) => (
          <Pressable
            key={period}
            onPress={(event) => {
              event.stopPropagation();
              setBillingPeriod(period);
              onSubscriptionPeriodChange(period);
              onPress?.();
            }}
            style={[
              styles.onboardingToggleChip,
              billingPeriod === period && styles.onboardingToggleChipActive,
            ]}
          >
            <Text
              style={[
                styles.onboardingToggleText,
                billingPeriod === period && styles.onboardingToggleTextActive,
              ]}
            >
              {period === "yearly" ? "Yearly" : "Monthly"}
            </Text>
          </Pressable>
        ))}
      </View>
    );

    return (
      <SafeAreaView style={styles.onboardingScreen}>
        <View style={styles.onboardingHeader}>
          <View style={styles.onboardingLogo}>
            <Ionicons name="sparkles" size={28} color={colors.white} />
          </View>
          <Text style={styles.onboardingTitle}>{title ?? "Choose Your Plan"}</Text>
          <Text style={styles.onboardingSubtitle}>Start with a free trial or go premium</Text>
        </View>

        <ScrollView contentContainerStyle={styles.onboardingList}>
          <Pressable
            onPress={() => setSelectedPlan("base")}
            style={({ pressed }) => [
              styles.onboardingPlanCard,
              activeSelection === "base" && styles.onboardingPlanCardSelected,
              pressed && styles.onboardingCardPressed,
            ]}
          >
            <View style={styles.onboardingCardHeader}>
              <View style={styles.onboardingBadge}>
                <Text style={styles.onboardingBadgeText}>{trialBadge}</Text>
              </View>
              {renderToggle()}
            </View>
            <Text style={styles.onboardingPlanName}>Start Free Trial</Text>
            <View style={styles.onboardingPriceRow}>
              <Text style={styles.onboardingPrice}>CHF 0</Text>
              <Text style={styles.onboardingPriceSuffix}>for 14 days</Text>
            </View>
            <Text style={styles.onboardingSubtext}>Then {basePrice}/{periodLabel}</Text>
            <View style={styles.onboardingFeatureGrid}>
              {trialFeatures.map((feature) => (
                <View key={feature} style={styles.onboardingFeature}>
                  <Ionicons name="checkmark" size={14} color={colors.gray600} />
                  <Text style={styles.onboardingFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <View style={styles.onboardingAfterTrial}>
              <Text style={styles.onboardingAfterTrialText}>
                After trial: Manual recipes, collections, favorites
              </Text>
            </View>
            {activeSelection === "base" && (
              <View style={styles.onboardingCheckmark}>
                <Ionicons name="checkmark" size={14} color={colors.white} />
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setSelectedPlan("premium")}
            style={({ pressed }) => [
              styles.onboardingPlanCard,
              activeSelection === "premium" && styles.onboardingPlanCardSelected,
              pressed && styles.onboardingCardPressed,
            ]}
          >
            <View style={styles.onboardingCardHeader}>
              <View style={styles.onboardingBadge}>
                <Text style={styles.onboardingBadgeText}>{premiumBadge}</Text>
              </View>
              {renderToggle()}
            </View>
            <Text style={styles.onboardingPlanName}>Recipefy Premium</Text>
            <View style={styles.onboardingPriceRow}>
              <Text style={styles.onboardingPrice}>{premiumPrice}</Text>
              <Text style={styles.onboardingPriceSuffix}>/{periodLabel}</Text>
            </View>
            <Text style={styles.onboardingSubtext}>
              {isYearly ? "Save 30% compared to monthly" : "Best for regular cooking"}
            </Text>
            <View style={styles.onboardingFeatureGrid}>
              {premiumFeatures.map((feature, index) => (
                <View
                  key={feature}
                  style={[
                    styles.onboardingFeature,
                    index === premiumFeatures.length - 1 && styles.onboardingFeatureWide,
                  ]}
                >
                  <Ionicons name="checkmark" size={14} color={colors.gray600} />
                  <Text style={styles.onboardingFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>
            {activeSelection === "premium" && (
              <View style={styles.onboardingCheckmark}>
                <Ionicons name="checkmark" size={14} color={colors.white} />
              </View>
            )}
          </Pressable>
        </ScrollView>

        <View style={styles.onboardingFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.onboardingContinueButton,
              pressed && styles.onboardingCardPressed,
            ]}
            onPress={async () => {
              if (activeSelection === "premium") {
                await safePlanChange("premium");
              } else {
                await safePlanChange("base");
              }
              onContinue?.();
            }}
          >
            <Text style={styles.onboardingContinueText}>
              {activeSelection === "premium" ? "Continue with Premium" : "Start Free Trial"}
            </Text>
          </Pressable>
          <Text style={styles.onboardingDisclaimer}>
            Cancel anytime. No credit card required for trial.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showPlanOptions) {
    const isCurrentBase = plan === "base";
    const isCurrentPremium = plan === "premium";
    const nextPlanId = pendingPlan === "subscription" ? "premium" : "base";
    const showConfirm = nextPlanId !== plan;
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => setShowPlanOptions(false)} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={20} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Change Plan</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.planModalSubtitle}>Choose the plan that fits you</Text>
            <View style={styles.modalToggle}>
              {(["monthly", "yearly"] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => {
                    setPendingBaseBilling(period);
                    setPendingSubscriptionBilling(period);
                  }}
                  style={[styles.modalToggleChip, pendingBaseBilling === period && styles.modalToggleChipActive]}
                >
                  <Text
                    style={[
                      styles.modalToggleText,
                      pendingBaseBilling === period && styles.modalToggleTextActive,
                    ]}
                  >
                    {period === "monthly" ? "Monthly" : "Yearly"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.planList}>
              <Pressable
                style={[
                  styles.planCard,
                  pendingPlan === "base" && !isCurrentBase && styles.planCardSelected,
                  isCurrentBase && styles.planCardCurrent,
                ]}
                onPress={() => {
                  if (isCurrentBase) return;
                  setPendingPlan("base");
                }}
              >
                {pendingPlan === "base" && !isCurrentBase && (
                  <View style={styles.planOptionCheck}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                )}
                {isCurrentBase && (
                  <View style={styles.planCurrentBadge}>
                    <Ionicons name="checkmark" size={12} color={colors.white} />
                    <Text style={styles.planCurrentBadgeText}>Current</Text>
                  </View>
                )}
                <View style={styles.planCardHeader}>
                  <View style={styles.planHeaderLeft}>
                    <Text style={styles.planOptionTitle}>
                      Recipefy Base
                    </Text>
                    <Text style={styles.planBillingLabel}>
                      Billed {pendingBaseBilling === "yearly" ? "yearly" : "monthly"}
                    </Text>
                    <View style={styles.planPriceRow}>
                      <Text style={styles.planPriceAmount}>
                        {pendingBaseBilling === "yearly" ? "CHF 15" : "CHF 1.50"}
                      </Text>
                      <Text style={styles.planPricePeriod}>
                        / {pendingBaseBilling === "yearly" ? "year" : "month"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.planIncludes}>
                  {["Add recipes manually", "Collections & favorites", "Cooking mode", "Shopping list"].map((item) => (
                    <View key={item} style={styles.planIncludeRow}>
                      <Ionicons name="checkmark" size={12} color={colors.gray500} />
                      <Text style={styles.planIncludeText}>{item}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.planNoteText}>
                  After 14 days, the Base subscription starts and trial actions expire. You can add imports, translations, optimizations, or AI assistant messages anytime.
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.planCard,
                  pendingPlan === "subscription" && !isCurrentPremium && styles.planCardSelected,
                  isCurrentPremium && styles.planCardCurrent,
                ]}
                onPress={() => {
                  if (isCurrentPremium) return;
                  setPendingPlan("subscription");
                }}
              >
                {pendingPlan === "subscription" && !isCurrentPremium && (
                  <View style={styles.planOptionCheck}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                )}
                {isCurrentPremium && (
                  <View style={styles.planCurrentBadge}>
                    <Ionicons name="checkmark" size={12} color={colors.white} />
                    <Text style={styles.planCurrentBadgeText}>Current</Text>
                  </View>
                )}
                <View style={styles.planCardHeader}>
                  <View style={styles.planHeaderLeft}>
                    <Text style={styles.planOptionTitle}>
                      Recipefy Premium
                    </Text>
                    <Text style={styles.planBillingLabel}>
                      Billed {pendingSubscriptionBilling === "yearly" ? "yearly" : "monthly"}
                    </Text>
                    <View style={styles.planPriceRow}>
                      <Text style={styles.planPriceAmount}>
                        {pendingSubscriptionBilling === "yearly" ? "CHF 69" : "CHF 6.90"}
                      </Text>
                      <Text style={styles.planPricePeriod}>
                        / {pendingSubscriptionBilling === "yearly" ? "year" : "month"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.planIncludes}>
                  {["25 recipe imports", "25 translations", "25 optimizations", "150 AI assistant messages"].map((item) => (
                    <View key={item} style={styles.planIncludeRow}>
                      <Ionicons name="checkmark" size={12} color={colors.gray500} />
                      <Text style={styles.planIncludeText}>{item}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.planNoteText}>Everything from Recipefy Base included.</Text>
                <Text style={[styles.planNoteText, { marginTop: spacing.xs }]}>
                  Unused actions do not roll over.
                </Text>
              </Pressable>
            </View>

            {showConfirm && (
              <Pressable
                style={styles.planUpgradeButton}
                onPress={() => {
                  if (!canSwitchPlans) {
                    Alert.alert(
                      "Manage subscription",
                      "Plan changes are handled in the App Store.",
                      [{ text: "Open App Store", onPress: openSubscriptionSettings }, { text: "Close" }]
                    );
                    return;
                  }
                  const nextPlan = pendingPlan === "subscription" ? "premium" : "base";
                  const nextBilling =
                    pendingPlan === "subscription" ? pendingSubscriptionBilling : pendingBaseBilling;
                  if (plan === "premium" && nextPlan === "base") {
                    Alert.alert(
                      "Downgrade plan?",
                      "Downgrades take effect at the end of your current billing period.",
                      [
                        { text: "Keep current plan", style: "cancel" },
                        {
                          text: "Continue",
                          onPress: () => {
                            void safePlanChange(nextPlan).then(() => {
                              onSubscriptionPeriodChange(nextBilling);
                              setShowPlanOptions(false);
                              Alert.alert("Plan updated", "Your changes have been saved.");
                            });
                          },
                        },
                      ]
                    );
                    return;
                  }
                  void safePlanChange(nextPlan).then(() => {
                    onSubscriptionPeriodChange(nextBilling);
                    setShowPlanOptions(false);
                    Alert.alert("Plan updated", "Your changes have been saved.");
                  });
                }}
              >
                <Text style={styles.planUpgradeText}>
                  Confirm Change to {pendingPlan === "subscription" ? "Recipefy Premium" : "Recipefy Base"}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  const usageCards = [
    {
      key: "imports",
      label: "Recipe Imports",
      used: usedImports,
      total: importLimit,
      monthly: planLimits.imports,
      trial: trialActive ? trialImportsRemaining : 0,
      extra: addonImports,
      icon: "download-outline" as const,
      bg: "rgba(168, 85, 247, 0.12)",
      color: "#a855f7",
    },
    {
      key: "translations",
      label: "AI Translations",
      used: usedTranslations,
      total: translationLimit,
      monthly: planLimits.translations,
      trial: trialActive ? trialTranslationsRemaining : 0,
      extra: addonTranslations,
      icon: "language-outline" as const,
      bg: "rgba(59, 130, 246, 0.12)",
      color: "#3b82f6",
    },
    {
      key: "optimizations",
      label: "AI Optimizations",
      used: usedOptimizations,
      total: optimizationLimit,
      monthly: planLimits.optimizations,
      trial: trialActive ? trialOptimizationsRemaining : 0,
      extra: addonOptimizations,
      icon: "sparkles-outline" as const,
      bg: "rgba(236, 72, 153, 0.12)",
      color: "#ec4899",
    },
    {
      key: "messages",
      label: "AI Assistant Messages",
      used: usedAiMessages,
      total: aiMessageLimit,
      monthly: planLimits.aiMessages,
      trial: trialActive ? trialAiMessagesRemaining : 0,
      extra: addonAiMessages,
      icon: "chatbubble-ellipses-outline" as const,
      bg: "rgba(34, 197, 94, 0.12)",
      color: "#22c55e",
    },
  ];

  const planFeatures = isSubscribed
    ? [
        "25 recipe imports per month",
        "25 AI translations per month",
        "25 AI optimizations per month",
        "150 AI assistant messages per month",
      ]
    : [
        "Unlimited manual recipes",
        "Collections & favorites",
        "Buy credits for imports, translations, optimizations & AI assistant messages",
      ];

  return (
    <View style={styles.screen}>
      <View style={styles.appHeader}>
        <View style={styles.appHeaderRow}>
          <Ionicons name="sparkles" size={22} color={colors.white} />
          <Text style={styles.appHeaderTitle}>Recipefy</Text>
        </View>
      </View>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>{title ?? "Plan & Usage"}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={[styles.planCardNew, shadow.md]}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderLeftNew}>
                <Text style={styles.planName}>{isSubscribed ? "Recipefy Premium" : "Recipefy Base"}</Text>
                <Text style={styles.planPriceNew}>
                  {isSubscribed ? currentSubscriptionPrice : currentBasePrice}
                </Text>
              </View>
              <Pressable style={styles.changeButton} onPress={() => setShowPlanOptions(true)}>
                <Text style={styles.changeButtonText}>Change</Text>
              </Pressable>
            </View>

            <View style={styles.planFeatureList}>
              {planFeatures.map((feature) => (
                <View key={feature} style={styles.planFeatureRow}>
                  <View style={styles.planCheck}>
                    <Ionicons name="checkmark" size={12} color="#16a34a" />
                  </View>
                  <Text style={styles.planFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {variant === "manage" && trialActive && !isSubscribed && (
              <Pressable
                style={[styles.cancelButton, trialCanceledAt && styles.cancelButtonDisabled]}
                onPress={handleCancelTrialPress}
                disabled={Boolean(trialCanceledAt)}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.red600} />
                <Text style={styles.cancelButtonText}>{trialCancelText}</Text>
              </Pressable>
            )}

            {variant === "manage" && isSubscribed && (
              <Pressable style={styles.cancelButton} onPress={handleCancelPress}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.red600} />
                <Text style={styles.cancelButtonText}>Cancel subscription</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.usageHeader}>MONTHLY USAGE</Text>
          <View style={styles.usageGrid}>
            {usageCards.map((card) => {
              const progress = card.total > 0 ? Math.min(1, card.used / card.total) : 0;
              const meta = formatUsageLabel(card.used, card.monthly, card.extra, card.trial);
              return (
                <View key={card.key} style={[styles.usageCard, shadow.md]}>
                  <View style={[styles.usageIcon, { backgroundColor: card.bg }]}>
                    <Ionicons name={card.icon} size={18} color={card.color} />
                  </View>
                  <View style={styles.usageNumbers}>
                    <Text style={styles.usageValue}>{formatNumber(card.used)}</Text>
                    <Text style={styles.usageTotal}>/ {formatNumber(card.total)}</Text>
                  </View>
                  <Text style={styles.usageLabel}>{card.label}</Text>
                  <Text style={styles.usageMeta}>{meta}</Text>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, { width: `${progress * 100}%`, backgroundColor: card.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {!showPlanOptions && (
          <View
            style={styles.section}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              creditsSectionLayout.current = { y, height };
              if (focusSection === "credits") {
                setTimeout(() => {
                  scrollToCredits();
                }, 50);
              }
            }}
          >
            <View style={styles.addonHeaderRow}>
              <Text style={styles.usageHeader}>Buy extra credits</Text>
              <Text style={styles.addonHelper}>Never expire</Text>
            </View>
            <View style={[styles.addonCard, shadow.md]}>
              {addonOptions.map((option, index) => (
                <Pressable
                  key={option.action}
                  style={[styles.addonRow, index < addonOptions.length - 1 && styles.addonRowDivider]}
                  onPress={() => confirmAddonPurchase(option)}
                >
                  <View>
                    <Text style={styles.addonTitle}>{option.title}</Text>
                    <Text style={styles.addonSubtitle}>{option.description}</Text>
                  </View>
                  <View style={styles.addonPrice}>
                    <Text style={styles.addonPriceText}>{option.price}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={18} color="#2563eb" />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Monthly credits reset on the 1st of each month</Text>
                <Text style={styles.infoSubtitle}>Extra credits purchased never expire and can be used anytime.</Text>
              </View>
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
    backgroundColor: colors.gray50,
  },
  appHeader: {
    height: 56,
    backgroundColor: colors.gray900,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  appHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appHeaderTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    color: colors.gray900,
  },
  content: {
    paddingBottom: 120,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
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
  statTitle: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "600",
    marginTop: spacing.sm,
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
  planCardNew: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: spacing.md,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planHeaderLeftNew: {
    gap: 4,
  },
  planName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
  },
  planPriceNew: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  changeButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  planFeatureList: {
    gap: spacing.sm,
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  planCheck: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  planFeatureText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray600,
  },
  cancelButton: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.red600,
  },
  usageHeader: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.gray500,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  usageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  usageCard: {
    width: "48%",
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  usageIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  usageNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  usageValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.gray900,
  },
  usageTotal: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray400,
  },
  usageLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  usageMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray500,
    marginBottom: spacing.sm,
  },
  usageTrack: {
    height: 6,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  usageFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  addonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addonHelper: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray400,
  },
  addonCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: "hidden",
  },
  addonRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  infoCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  infoSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#2563eb",
    marginTop: 4,
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
  currentPlanHeaderLeft: {
    flex: 1,
    gap: 2,
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
  changePlanButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  changePlanText: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
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
  planModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    marginBottom: spacing.sm,
  },
  modalToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 4,
    alignSelf: "flex-start",
    marginBottom: spacing.lg,
  },
  modalToggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  modalToggleChipActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  modalToggleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: colors.gray500,
  },
  modalToggleTextActive: {
    color: colors.gray900,
  },
  planList: {
    gap: spacing.md,
  },
  planCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.md,
    position: "relative",
  },
  planCardSelected: {
    borderColor: "#e9d5ff",
    backgroundColor: "#f5f3ff",
  },
  planCardCurrent: {
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  planOptionCheck: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  planCurrentBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  planCurrentBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
  planOptionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: colors.gray900,
  },
  planBillingLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    marginTop: 4,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  planPriceAmount: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    color: colors.gray900,
  },
  planPricePeriod: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
  },
  cancelCard: {
    borderColor: colors.red500,
    backgroundColor: colors.white,
  },
  cancelInlineCard: {
    marginTop: spacing.md,
  },
  cancelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cancelIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTitle: {
    color: colors.red500,
  },
  cancelSubtitle: {
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
  addonList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addonTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  addonSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  addonPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addonPriceText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray700,
    fontWeight: "600",
  },
  planNoteText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    marginTop: spacing.sm,
  },
  planUpgradeButton: {
    marginTop: spacing.md,
    backgroundColor: colors.purple600,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: "center",
    ...shadow.lg,
  },
  planUpgradeButtonDisabled: {
    backgroundColor: colors.gray100,
  },
  planUpgradeText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  planUpgradeTextDisabled: {
    color: colors.gray500,
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: "center",
    gap: spacing.sm,
  },
  onboardingLogo: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  onboardingTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.gray900,
    textAlign: "center",
  },
  onboardingSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
    textAlign: "center",
  },
  onboardingList: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  onboardingPlanCard: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.md,
  },
  onboardingPlanCardSelected: {
    borderColor: colors.purple500,
    backgroundColor: colors.purple100,
  },
  onboardingCardPressed: {
    opacity: 0.92,
  },
  onboardingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  onboardingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  onboardingBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.gray700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  onboardingToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gray100,
    padding: 2,
    borderRadius: radius.full,
  },
  onboardingToggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  onboardingToggleChipActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  onboardingToggleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: colors.gray500,
  },
  onboardingToggleTextActive: {
    color: colors.gray900,
  },
  onboardingPlanName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.gray900,
  },
  onboardingPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  onboardingPrice: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: colors.gray900,
  },
  onboardingPriceSuffix: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
  },
  onboardingSubtext: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
  },
  onboardingFeatureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.sm,
    columnGap: spacing.lg,
  },
  onboardingFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    width: "48%",
  },
  onboardingFeatureWide: {
    width: "100%",
  },
  onboardingFeatureText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  onboardingAfterTrial: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
  },
  onboardingAfterTrialText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray600,
  },
  onboardingCheckmark: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
  },
  onboardingFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: spacing.sm,
    backgroundColor: colors.white,
  },
  onboardingContinueButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  onboardingContinueText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  onboardingDisclaimer: {
    fontSize: 11,
    lineHeight: 16,
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
