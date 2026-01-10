import React, { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

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

const BASE_PLAN = {
  title: "Recepify Base",
  yearly: {
    price: "CHF 15 / year",
    alt: "or CHF 1.50 / month",
  },
  monthly: {
    price: "CHF 1.50 / month",
    alt: "or CHF 15 / year",
  },
  trialTitle: "14-day free trial",
  trialSubtitle:
    "Includes 10 imports, 10 translations, 10 optimizations, and 100 AI messages. Trial actions expire after 14 days. Base monthly starts automatically.",
  bestFor: "Best for cooking on your own schedule.",
  included: [
    "Add recipes manually",
    "Access all recipes",
    "Collections & favorites",
    "Cooking mode",
    "Shopping list",
  ],
  aiTitle: "Need AI or imports?",
  aiIntro: "No expensive subscription pressure. Buy add-ons only when you need:",
  aiBullets: [
    "Import recipes",
    "Scan recipes",
    "AI cooking assistant (optimize imported recipes, fix steps, improve results)",
  ],
  aiNote: "After 14 days, the Base subscription starts and trial actions expire. You can buy add-ons anytime.",
  cta: "Start free trial",
  ctaHelper: "No charge today · Cancel anytime",
};

const SUBSCRIPTION_PLAN = {
  title: "Recepify Premium",
  bestFor: "Best for frequent cooks who import often.",
  yearly: {
    price: "CHF 69 / year",
    helper: ["Best price overall", "Save vs monthly"],
  },
  monthly: {
    price: "CHF 6.90 / month",
    helper: ["More flexibility"],
  },
  includedEveryMonth: ["25 recipe imports", "25 translations", "25 optimizations", "150 AI messages"],
  alsoIncluded: ["Everything from Recepify Base"],
  notIncluded: ["Unused actions do not roll over"],
  needMore: "Buy add-ons anytime.",
};

export const ChoosePlanScreen: React.FC<ChoosePlanScreenProps> = ({
  onContinue,
  initialPlan = "base",
  initialBilling = "yearly",
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBilling);
  const [baseBillingCycle, setBaseBillingCycle] = useState<BillingCycle>("yearly");
  const [showBaseDetails, setShowBaseDetails] = useState(false);
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false);
  const subscriptionPrice = billingCycle === "yearly" ? SUBSCRIPTION_PLAN.yearly : SUBSCRIPTION_PLAN.monthly;
  const basePrice = baseBillingCycle === "yearly" ? BASE_PLAN.yearly : BASE_PLAN.monthly;

  const handleContinue = () => {
    onContinue({
      selectedPlan,
      billingCycle: selectedPlan === "subscription" ? billingCycle : baseBillingCycle,
    });
  };

  const subscriptionHelpers = useMemo(() => subscriptionPrice.helper, [subscriptionPrice]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.subtitle}>Pick the plan that fits you best. You can change this later.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PlanCard
          title={BASE_PLAN.title}
          selected={selectedPlan === "base"}
          onPress={() => setSelectedPlan("base")}
          headerRight={
            <View>
              <Text style={styles.billingLabel}>Billing</Text>
              <SegmentedToggle
                options={[
                  { label: "Yearly", value: "yearly" },
                  { label: "Monthly", value: "monthly" },
                ]}
                value={baseBillingCycle}
                onChange={setBaseBillingCycle}
              />
            </View>
          }
        >
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{basePrice.price}</Text>
            <Text style={styles.priceAlt}>{basePrice.alt}</Text>
          </View>

          <View style={styles.trialBlock}>
            <Text style={styles.trialTitle}>{BASE_PLAN.trialTitle}</Text>
            <Text style={styles.trialSubtitle}>{BASE_PLAN.trialSubtitle}</Text>
          </View>

          <Text style={styles.bestFor}>{BASE_PLAN.bestFor}</Text>

          <FeatureSection
            title="Included"
            bullets={showBaseDetails ? BASE_PLAN.included : BASE_PLAN.included.slice(0, 3)}
            icon="check"
          />

          {showBaseDetails && (
            <View style={styles.aiBlock}>
              <Text style={styles.sectionTitle}>{BASE_PLAN.aiTitle}</Text>
              <Text style={styles.aiIntro}>{BASE_PLAN.aiIntro}</Text>
              <View style={styles.bulletList}>
                {BASE_PLAN.aiBullets.map((bullet) => (
                  <BulletRow key={bullet} text={bullet} />
                ))}
              </View>
              <Text style={styles.aiNote}>{BASE_PLAN.aiNote}</Text>
            </View>
          )}

          <Pressable
            onPress={() => setShowBaseDetails((prev) => !prev)}
            style={({ pressed }) => [styles.readMoreButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={showBaseDetails ? "Show less details" : "Read more details"}
          >
            <Text style={styles.readMoreText}>{showBaseDetails ? "Show less" : "Read more"}</Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedPlan("base")}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={BASE_PLAN.cta}
          >
            <Text style={styles.secondaryButtonText}>{BASE_PLAN.cta}</Text>
          </Pressable>
          <Text style={styles.helperText}>{BASE_PLAN.ctaHelper}</Text>
        </PlanCard>

        <PlanCard
          title={SUBSCRIPTION_PLAN.title}
          selected={selectedPlan === "subscription"}
          onPress={() => setSelectedPlan("subscription")}
          badge={<MostPopularBadge />}
          headerRight={
            <View>
              <Text style={styles.billingLabel}>Billing</Text>
              <SegmentedToggle
                options={[
                  { label: "Yearly", value: "yearly" },
                  { label: "Monthly", value: "monthly" },
                ]}
                value={billingCycle}
                onChange={setBillingCycle}
              />
            </View>
          }
        >
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{subscriptionPrice.price}</Text>
            {subscriptionHelpers.map((line) => (
              <Text key={line} style={styles.priceHelper}>
                {line}
              </Text>
            ))}
          </View>

          <Text style={styles.bestFor}>{SUBSCRIPTION_PLAN.bestFor}</Text>

          <FeatureSection
            title="Included every month"
            bullets={
              showSubscriptionDetails
                ? SUBSCRIPTION_PLAN.includedEveryMonth
                : SUBSCRIPTION_PLAN.includedEveryMonth.slice(0, 2)
            }
            icon="check"
          />

          {showSubscriptionDetails && (
            <>
              <FeatureSection title="Also included" bullets={SUBSCRIPTION_PLAN.alsoIncluded} icon="check" />
              <FeatureSection title="Not included" bullets={SUBSCRIPTION_PLAN.notIncluded} icon="close" />
              <View style={styles.needMoreBlock}>
                <Text style={styles.sectionTitle}>Need more?</Text>
                <Text style={styles.sectionBody}>{SUBSCRIPTION_PLAN.needMore}</Text>
              </View>
            </>
          )}

          <Pressable
            onPress={() => setShowSubscriptionDetails((prev) => !prev)}
            style={({ pressed }) => [styles.readMoreButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={showSubscriptionDetails ? "Show less details" : "Read more details"}
          >
            <Text style={styles.readMoreText}>{showSubscriptionDetails ? "Show less" : "Read more"}</Text>
          </Pressable>

        </PlanCard>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

interface PlanCardProps {
  title: string;
  selected: boolean;
  onPress: () => void;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

const PlanCard: React.FC<PlanCardProps> = ({ title, selected, onPress, badge, headerRight, children }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} plan`}
    >
      {badge}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.headerRight}>{headerRight}</View>
      </View>
      {children}
    </Pressable>
  );
};

interface FeatureSectionProps {
  title: string;
  bullets: string[];
  icon: "check" | "close";
}

const FeatureSection: React.FC<FeatureSectionProps> = ({ title, bullets, icon }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.bulletList}>
      {bullets.map((bullet) => (
        <BulletRow key={bullet} text={bullet} icon={icon} />
      ))}
    </View>
  </View>
);

interface BulletRowProps {
  text: string;
  icon?: "check" | "close";
}

const BulletRow: React.FC<BulletRowProps> = ({ text, icon = "check" }) => (
  <View style={styles.bulletRow}>
    <View style={[styles.bulletIcon, icon === "close" && styles.bulletIconMuted]}>
      <Ionicons
        name={icon === "close" ? "close" : "checkmark"}
        size={12}
        color={icon === "close" ? colors.gray400 : colors.purple600}
      />
    </View>
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

interface SegmentedToggleOption<T> {
  label: string;
  value: T;
}

interface SegmentedToggleProps<T> {
  options: Array<SegmentedToggleOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

const SegmentedToggle = <T,>({ options, value, onChange }: SegmentedToggleProps<T>) => (
  <View style={styles.segmented}>
    {options.map((option) => {
      const isActive = option.value === value;
      return (
        <Pressable
          key={option.label}
          onPress={() => onChange(option.value)}
          style={[styles.segment, isActive && styles.segmentActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
          accessibilityLabel={option.label}
        >
          <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const MostPopularBadge = () => (
  <View style={styles.badge}>
    <Ionicons name="star" size={12} color={colors.white} />
    <Text style={styles.badgeText}>Most popular</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: colors.gray900,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray500,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gray200,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.md,
  },
  cardSelected: {
    borderColor: colors.purple600,
    backgroundColor: "rgba(141, 74, 255, 0.08)",
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.gray900,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  badge: {
    position: "absolute",
    top: -12,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.purple600,
    ...shadow.md,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  priceBlock: {
    gap: 4,
  },
  price: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.gray900,
  },
  priceAlt: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  priceHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  trialBlock: {
    borderRadius: radius.lg,
    backgroundColor: colors.gray50,
    padding: spacing.md,
    gap: 2,
  },
  trialTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  trialSubtitle: {
    ...typography.caption,
    color: colors.gray500,
  },
  bestFor: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  sectionBody: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  bulletList: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bulletIcon: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.purple100,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletIconMuted: {
    backgroundColor: colors.gray100,
  },
  bulletText: {
    ...typography.bodySmall,
    color: colors.gray700,
    flex: 1,
  },
  aiBlock: {
    gap: spacing.sm,
  },
  aiIntro: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  aiNote: {
    ...typography.caption,
    color: colors.gray500,
  },
  needMoreBlock: {
    gap: spacing.xs,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  helperText: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: "center",
  },
  readMoreButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  readMoreText: {
    ...typography.bodySmall,
    color: colors.purple600,
    fontWeight: "600",
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 4,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  segmentActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  segmentText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  segmentTextActive: {
    color: colors.gray900,
    fontWeight: "600",
  },
  billingLabel: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: "right",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray900,
    ...shadow.lg,
  },
  primaryButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
});

// Example usage:
// <ChoosePlanScreen
//   onContinue={(payload) => {
//     console.log("Selected plan", payload);
//   }}
// />
