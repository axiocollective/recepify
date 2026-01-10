import React, { useMemo, useState } from "react";
import { Alert, Dimensions, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  onBack: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
  allowPlanSwitchOverride?: boolean;
  variant?: "manage" | "onboarding";
}

const BASE_PLAN = {
  id: "base" as const,
  name: "Recepify Base",
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
  name: "Recepify Premium",
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
  const planLabel = plan === "premium" ? "Recepify Premium" : "Recepify Base";
  const importProgress =
    importLimit > 0 ? Math.min(1, usedImports / importLimit) : usedImports > 0 ? 1 : 0;
  const translationProgress =
    translationLimit > 0 ? Math.min(1, usedTranslations / translationLimit) : usedTranslations > 0 ? 1 : 0;
  const optimizationProgress =
    optimizationLimit > 0 ? Math.min(1, usedOptimizations / optimizationLimit) : usedOptimizations > 0 ? 1 : 0;
  const aiMessageProgress =
    aiMessageLimit > 0 ? Math.min(1, usedAiMessages / aiMessageLimit) : usedAiMessages > 0 ? 1 : 0;
  const hasDevPlanSwitch = process.env.EXPO_PUBLIC_DEV_PLAN_SWITCH === "true";
  const [allowPlanSwitch, setAllowPlanSwitch] = useState(hasDevPlanSwitch);
  const canSwitchPlans = allowPlanSwitchOverride ?? allowPlanSwitch;
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
    const parsedEnd = subscriptionEndsAt ? new Date(subscriptionEndsAt) : null;
    const hasValidEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) && parsedEnd > now;
    const endDate = hasValidEnd
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
      description: "Use anytime",
      quantity: 15,
    },
    {
      action: "translation" as const,
      title: "+15 recipe translations",
      price: "CHF 4",
      description: "Use anytime",
      quantity: 15,
    },
    {
      action: "optimization" as const,
      title: "+15 recipe optimizations",
      price: "CHF 4",
      description: "Use anytime",
      quantity: 15,
    },
    {
      action: "ai_message" as const,
      title: "+100 AI assistant messages",
      price: "CHF 5",
      description: "Use anytime",
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

  if (isOnboarding) {
    const onboardingPlans: Array<{
      id: "base" | "premium";
      name: string;
      price: string;
      period?: string;
      description: string;
      features: string[];
      popular?: boolean;
      note?: string;
    }> = [
      {
        id: "base",
        name: BASE_PLAN.name,
        price: BASE_PLAN.price,
        description: BASE_PLAN.subtitle,
        features: BASE_PLAN.includes,
      },
      {
        id: "premium",
        name: paidPlan.name,
        price: billingPeriod === "yearly" ? "CHF 69" : "CHF 6.90",
        period: billingPeriod === "yearly" ? "/ year" : "/ month",
        description: paidPlan.subtitle,
        features: paidPlan.includes,
        popular: true,
        note: paidPlan.note,
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
            {option.id === "premium" && (
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
              if (activeSelection === "premium") {
                await safePlanChange("premium");
              } else {
                await safePlanChange("base");
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

  if (showPlanOptions) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => setShowPlanOptions(false)} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={20} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Choose your plan</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <View style={styles.planList}>
              <Pressable
                style={[
                  styles.planCard,
                  pendingPlan === "base" && styles.planCardSelected,
                ]}
                onPress={() => setPendingPlan("base")}
              >
                <View style={styles.planCardHeader}>
                  <View style={styles.planHeaderLeft}>
                    <Text style={[styles.planTitle, pendingPlan === "base" && styles.planTitleSelected]}>
                      Recepify Base
                    </Text>
                    <Text style={styles.planPrice}>{pendingBasePrice}</Text>
                    <Text style={styles.planSubtitle}>{pendingBaseAlt}</Text>
                  </View>
                  <View style={styles.planHeaderRight}>
                    <View style={styles.billingToggle}>
                      {(["yearly", "monthly"] as const).map((period) => (
                        <Pressable
                          key={period}
                          onPress={() => setPendingBaseBilling(period)}
                          style={[styles.billingChip, pendingBaseBilling === period && styles.billingChipActive]}
                        >
                          <Text
                            style={[
                              styles.billingChipText,
                              pendingBaseBilling === period && styles.billingChipTextActive,
                            ]}
                          >
                            {period === "yearly" ? "Yearly" : "Monthly"}
                          </Text>
                        </Pressable>
                      ))}
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
                  After 14 days, the Base subscription starts and trial actions expire. You can add more imports, translations, optimizations, or AI messages anytime.
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.planCard,
                  pendingPlan === "subscription" && styles.planCardSelected,
                ]}
                onPress={() => setPendingPlan("subscription")}
              >
                <View style={styles.planCardHeader}>
                  <View style={styles.planHeaderLeft}>
                    <Text style={[styles.planTitle, pendingPlan === "subscription" && styles.planTitleSelected]}>
                      Recepify Premium
                    </Text>
                    <Text style={styles.planPrice}>{pendingSubscriptionPrice}</Text>
                    <Text style={styles.planSubtitle}>
                      {pendingSubscriptionBilling === "yearly" ? "Best price overall" : "More flexibility"}
                    </Text>
                  </View>
                  <View style={styles.planHeaderRight}>
                    <View style={styles.billingToggle}>
                      {(["yearly", "monthly"] as const).map((period) => (
                        <Pressable
                          key={period}
                          onPress={() => setPendingSubscriptionBilling(period)}
                          style={[
                            styles.billingChip,
                            pendingSubscriptionBilling === period && styles.billingChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.billingChipText,
                              pendingSubscriptionBilling === period && styles.billingChipTextActive,
                            ]}
                          >
                            {period === "yearly" ? "Yearly" : "Monthly"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.planIncludes}>
                  {["25 recipe imports", "25 translations", "25 optimizations", "150 AI messages"].map((item) => (
                    <View key={item} style={styles.planIncludeRow}>
                      <Ionicons name="checkmark" size={12} color={colors.gray500} />
                      <Text style={styles.planIncludeText}>{item}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.planNoteText}>Everything from Recepify Base included.</Text>
                <Text style={[styles.planNoteText, { marginTop: spacing.xs }]}>
                  Unused actions do not roll over.
                </Text>
              </Pressable>
            </View>

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
              <Text style={styles.planUpgradeText}>Save changes</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {!isOnboarding && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Usage</Text>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="book-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statTitle}>Recipes saved</Text>
                <Text style={styles.statValue}>{recipesCount}</Text>
                <Text style={styles.statLabel}>Total in your library</Text>
              </View>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="download-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statTitle}>Recipe imports</Text>
                <Text style={styles.statValue}>{formatNumber(usedImports)}</Text>
                <Text style={styles.statLabel}>
                  {formatUsageLabel(
                    usedImports,
                    isSubscribed ? planLimits.imports : 0,
                    addonImports,
                    !isSubscribed && trialActive ? trialImportsRemaining : 0
                  )}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${importProgress * 100}%` }]} />
                </View>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="language-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statTitle}>Recipe translations</Text>
                <Text style={styles.statValue}>{formatNumber(usedTranslations)}</Text>
                <Text style={styles.statLabel}>
                  {formatUsageLabel(
                    usedTranslations,
                    isSubscribed ? planLimits.translations : 0,
                    addonTranslations,
                    !isSubscribed && trialActive ? trialTranslationsRemaining : 0
                  )}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${translationProgress * 100}%` }]} />
                </View>
              </View>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statTitle}>Recipe optimizations</Text>
                <Text style={styles.statValue}>{formatNumber(usedOptimizations)}</Text>
                <Text style={styles.statLabel}>
                  {formatUsageLabel(
                    usedOptimizations,
                    isSubscribed ? planLimits.optimizations : 0,
                    addonOptimizations,
                    !isSubscribed && trialActive ? trialOptimizationsRemaining : 0
                  )}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${optimizationProgress * 100}%` }]} />
                </View>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, shadow.md]}>
                <View style={styles.statIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.purple600} />
                </View>
                <Text style={styles.statTitle}>AI assistant messages</Text>
                <Text style={styles.statValue}>{formatNumber(usedAiMessages)}</Text>
                <Text style={styles.statLabel}>
                  {formatUsageLabel(
                    usedAiMessages,
                    isSubscribed ? planLimits.aiMessages : 0,
                    addonAiMessages,
                    !isSubscribed && trialActive ? trialAiMessagesRemaining : 0
                  )}
                </Text>
                <View style={styles.statBarTrack}>
                  <View style={[styles.statBarFill, { width: `${aiMessageProgress * 100}%` }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Plan</Text>
          <Pressable
            style={[styles.currentPlanCard, shadow.md]}
            onPress={() => setShowPlanOptions(true)}
          >
            <View style={styles.currentPlanHeader}>
              <View style={styles.currentPlanHeaderLeft}>
                <Text style={styles.currentPlanName}>
                  {isSubscribed ? "Recepify Premium" : "Recepify Base"}
                </Text>
                <Text style={styles.currentPlanPrice}>
                  {isSubscribed ? currentSubscriptionPrice : currentBasePrice}
                </Text>
                <Text style={styles.currentPlanSubtitle}>
                  {isSubscribed
                    ? "Includes monthly imports, translations, optimizations, and AI messages."
                    : trialActive
                    ? `Trial active · ${trialDaysLeft} days left · 10 imports, 10 translations, 10 optimizations, 100 AI messages`
                    : "Base plan active. Add-ons unlock imports, translations, optimizations, and AI messages."}
                </Text>
              </View>
              <Pressable
                style={styles.changePlanButton}
                onPress={() => setShowPlanOptions(true)}
              >
                <Text style={styles.changePlanText}>{showPlanOptions ? "Close" : "Change"}</Text>
              </Pressable>
            </View>
          </Pressable>

          {variant === "manage" && (
            <Pressable
              style={[styles.planCard, styles.cancelCard, styles.cancelInlineCard]}
              onPress={handleCancelPress}
            >
              <View style={styles.planCardHeader}>
                <View style={styles.cancelRow}>
                  <View style={styles.cancelIcon}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.red500} />
                  </View>
                  <View>
                    <Text style={[styles.planTitle, styles.cancelTitle]}>
                      {subscriptionStatus === "canceled" ? "Subscription canceled" : "Cancel subscription"}
                    </Text>
                    {subscriptionStatus === "canceled" && (
                      <Text style={[styles.planSubtitle, styles.cancelSubtitle]}>
                        {canceledLabel ? `Active until ${canceledLabel}` : "Active until the end of your period"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          )}

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
          <Text style={styles.sectionLabel}>Add-ons</Text>
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <View>
                <Text style={styles.planTitle}>Extra actions</Text>
                <Text style={styles.planSubtitle}>Tap to add more anytime. Add-ons never expire.</Text>
              </View>
            </View>
            <View style={styles.addonList}>
              {addonOptions.map((option) => (
                <Pressable
                  key={option.action}
                  style={styles.addonRow}
                  onPress={() => onBuyCredits(option.action, option.quantity)}
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
          </View>
          </View>
        )}

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
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addonTitle: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  addonSubtitle: {
    ...typography.caption,
    color: colors.gray500,
  },
  addonPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addonPriceText: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "600",
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
