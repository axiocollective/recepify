import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";
import { Screen } from "../data/types";
import { useApp } from "../data/AppContext";
import { getImportLimitMessage, getImportLimitTitle, isImportLimitReached } from "../data/usageLimits";
import { Alert } from "react-native";

interface ImportQuickActionsProps {
  onNavigate: (screen: Screen) => void;
  onAddManually: () => void;
  inboxCount?: number;
  importReadyCount?: number;
}

const actions: Array<{ id: Screen | "manual" | "inbox"; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "importFromLink", label: "Share Link", icon: "link-outline" },
  { id: "scanRecipe", label: "Scan", icon: "camera-outline" },
  { id: "manual", label: "Manually", icon: "add" },
  { id: "inbox", label: "Inbox", icon: "mail-outline" },
];

export const ImportQuickActions: React.FC<ImportQuickActionsProps> = ({
  onNavigate,
  onAddManually,
  inboxCount = 0,
  importReadyCount = 0,
}) => {
  const { plan, usageSummary, addonImports, trialActive, trialImportsRemaining, navigateTo } = useApp();
  const importLimitReached = isImportLimitReached(plan, usageSummary, trialActive, addonImports, trialImportsRemaining);
  const limitMessage = getImportLimitMessage(plan);
  const openPlans = () => navigateTo("planBilling", { focus: "credits" });
  const limitTitle = getImportLimitTitle(plan);

  const handleAction = (id: Screen | "manual" | "inbox") => {
    if (id === "manual") {
      onAddManually();
      return;
    }
    if (id === "inbox") {
      onNavigate("importInbox");
      return;
    }
    if ((id === "importFromLink" || id === "scanRecipe") && importLimitReached) {
      if (plan === "premium") {
        Alert.alert(limitTitle, limitMessage, [
          { text: "Buy more", onPress: openPlans },
          { text: "Cancel", style: "cancel" },
        ]);
        return;
      }
      Alert.alert(limitTitle, limitMessage, [
        { text: "Buy more", onPress: openPlans },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    onNavigate(id);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadow.md]}>
        <Text style={styles.title}>Add Recipe</Text>
        <View style={styles.row}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => handleAction(action.id)}
              style={styles.action}
            >
              <View
                style={styles.iconWrap}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={colors.white}
                />
                {action.id === "inbox" && importReadyCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{importReadyCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.label}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.xl,
  },
  title: {
    ...typography.bodySmall,
    fontWeight: "500",
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  action: {
    alignItems: "center",
    gap: spacing.sm,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.gray600,
    textAlign: "center",
    maxWidth: 80,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
});
