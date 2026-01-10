import React, { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing } from "../theme/theme";

type PlanSelection = "base" | "subscription";
type BillingCycle = "yearly" | "monthly";

interface ChoosePlanScreenProps {
  onContinue: (payload: {
    selectedPlan: PlanSelection;
    billingCycle: BillingCycle | null;
  }) => void;
  initialPlan?: PlanSelection;
  initialBilling?: BillingCycle;
}

const TRIAL_FEATURES = [
  "10 imports",
  "10 AI translations",
  "10 AI optimizations",
  "50 AI assistant messages",
];

const BASE_FEATURES = [
  "Unlimited manual recipe entry",
  "Collections & favorites",
  "Buy credits for AI features as needed",
];

const PREMIUM_FEATURES = [
  "25 imports/month",
  "25 AI translations",
  "25 AI optimizations",
  "150 AI assistant messages",
  "Everything from Base included",
];

export const ChoosePlanScreen: React.FC<ChoosePlanScreenProps> = ({
  onContinue,
  initialPlan = "base",
  initialBilling = "yearly",
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>(initialPlan);
  const [billingPeriod, setBillingPeriod] = useState<BillingCycle>(initialBilling);
  const [showBaseDetails, setShowBaseDetails] = useState(false);

  const isYearly = billingPeriod === "yearly";
  const periodLabel = isYearly ? "year" : "month";
  const basePrice = isYearly ? "CHF 15" : "CHF 1.50";
  const baseMonthlyPrice = "CHF 1.50";
  const premiumPrice = isYearly ? "CHF 69" : "CHF 8";

  const handleContinue = () => {
    onContinue({
      selectedPlan,
      billingCycle: billingPeriod,
    });
  };

  const renderToggle = () => (
    <View style={styles.toggle}>
      {(["monthly", "yearly"] as const).map((period) => (
        <Pressable
          key={period}
          onPress={(event) => {
            event.stopPropagation?.();
            setBillingPeriod(period);
          }}
          style={[styles.toggleChip, billingPeriod === period && styles.toggleChipActive]}
        >
          <Text style={[styles.toggleText, billingPeriod === period && styles.toggleTextActive]}>
            {period === "monthly" ? "Monthly" : "Yearly"}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Ionicons name="sparkles" size={28} color={colors.white} />
        </View>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>Start with a free trial or go premium</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => setSelectedPlan("base")}
          style={({ pressed }) => [
            styles.card,
            selectedPlan === "base" && styles.cardSelected,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>14 DAYS FREE</Text>
            </View>
          </View>

          <Text style={styles.planName}>Start Free Trial</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>CHF 0</Text>
            <Text style={styles.priceSuffix}>for 14 days</Text>
          </View>
          <Text style={styles.subtext}>Then Base monthly: {baseMonthlyPrice}/month</Text>

          <Text style={styles.sectionLabel}>During 14-day trial</Text>
          <View style={styles.featureGrid}>
            {TRIAL_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureItem}>
                <Ionicons name="checkmark" size={14} color={colors.gray600} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.readMoreRow}
            onPress={() => setShowBaseDetails((prev) => !prev)}
          >
            <Text style={styles.readMoreText}>Read more</Text>
            <Ionicons
              name={showBaseDetails ? "chevron-up" : "chevron-forward"}
              size={14}
              color={colors.gray500}
            />
          </Pressable>

          {showBaseDetails && (
            <View style={styles.afterTrial}>
              <Text style={styles.afterTrialLabel}>After trial (Base plan)</Text>
              {BASE_FEATURES.map((feature) => (
                <View key={feature} style={styles.afterTrialRow}>
                  <Ionicons name="checkmark" size={14} color={colors.gray600} />
                  <Text style={styles.afterTrialText}>{feature}</Text>
                </View>
              ))}
              <Text style={styles.afterTrialNote}>Base monthly starts after trial: {baseMonthlyPrice}/month</Text>
            </View>
          )}

          {selectedPlan === "base" && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => setSelectedPlan("subscription")}
          style={({ pressed }) => [
            styles.card,
            selectedPlan === "subscription" && styles.cardSelected,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>MOST POPULAR</Text>
            </View>
            {renderToggle()}
          </View>

          <Text style={styles.planName}>Recipefy Premium</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{premiumPrice}</Text>
            <Text style={styles.priceSuffix}>/{periodLabel}</Text>
          </View>
          <Text style={styles.subtext}>
            {isYearly ? "Save 30% compared to monthly" : "Best for regular cooking"}
          </Text>

          <View style={styles.featureGrid}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View
                key={feature}
                style={[styles.featureItem, index === PREMIUM_FEATURES.length - 1 && styles.featureItemWide]}
              >
                <Ionicons name="checkmark" size={14} color={colors.gray600} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {selectedPlan === "subscription" && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
            </View>
          )}
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.continueText}>
            {selectedPlan === "subscription" ? "Continue with Premium" : "Start Free Trial"}
          </Text>
        </Pressable>
        <Text style={styles.disclaimer}>Cancel anytime. No credit card required for trial.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.gray900,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardSelected: {
    borderColor: colors.purple500,
    backgroundColor: colors.purple100,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.gray700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gray100,
    padding: 2,
    borderRadius: radius.full,
  },
  toggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  toggleChipActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  toggleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: colors.gray500,
  },
  toggleTextActive: {
    color: colors.gray900,
  },
  planName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.gray900,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  price: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: colors.gray900,
  },
  priceSuffix: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
  },
  subtext: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.sm,
    columnGap: spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    width: "48%",
  },
  featureItemWide: {
    width: "100%",
  },
  featureText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  afterTrial: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
    gap: spacing.sm,
  },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  readMoreText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    fontWeight: "600",
  },
  afterTrialLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.gray600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  afterTrialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  afterTrialText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray700,
  },
  afterTrialNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray600,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.gray600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  checkmark: {
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
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  continueButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.gray400,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
});
