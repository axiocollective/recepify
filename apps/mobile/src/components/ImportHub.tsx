import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme/theme";
import { Screen } from "../data/types";

interface ImportHubProps {
  onNavigate: (screen: Screen) => void;
  onAddManually: () => void;
  sharedRecipesCount?: number;
}

export const ImportHub: React.FC<ImportHubProps> = ({ onNavigate, onAddManually, sharedRecipesCount = 0 }) => {
  const methods = [
    {
      id: "importInbox" as const,
      icon: "mail-outline" as const,
      title: "Inbox",
      description: "View recipes shared via your import inbox.",
      badge: sharedRecipesCount,
      action: () => onNavigate("importInbox"),
    },
    {
      id: "importFromLink" as const,
      icon: "link-outline" as const,
      title: "From Link",
      description: "Paste a TikTok, Instagram, YouTube, Pinterest or any recipe link.",
      action: () => onNavigate("importFromLink"),
    },
    {
      id: "scanRecipe" as const,
      icon: "camera-outline" as const,
      title: "Scan",
      description: "Take a photo of a recipe card or cookbook page.",
      action: () => onNavigate("scanRecipe"),
    },
    {
      id: "addManually" as const,
      icon: "add" as const,
      title: "Manual",
      description: "Start from scratch and type it out yourself.",
      action: onAddManually,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={() => onNavigate("home")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Add Recipe</Text>
          <Text style={styles.headerSubtitle}>Choose how you want to add a recipe</Text>
        </View>
      </View>

      <View style={styles.list}>
        {methods.map((method) => {
          const isInbox = method.id === "importInbox";
          const hasInboxItems = (method.badge ?? 0) > 0;
          return (
          <Pressable key={method.id} onPress={method.action} style={styles.card}>
            <View
              style={[
                styles.iconWrap,
                isInbox && hasInboxItems && styles.iconWrapInboxActive,
              ]}
            >
              <Ionicons name={method.icon} size={22} color={colors.white} />
              {method.badge && method.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{method.badge}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{method.title}</Text>
              <Text style={styles.cardSubtitle}>{method.description}</Text>
            </View>
          </Pressable>
        );
      })}
      </View>

      <View style={styles.help}>
        <Text style={styles.helpTitle}>How it works</Text>
        {[
          { title: "Import", detail: "Choose any method above to add a recipe." },
          { title: "AI Processing", detail: "Our AI extracts ingredients and steps." },
          { title: "Review & Save", detail: "Edit if needed, then save to your collection." },
        ].map((line, index) => (
          <View key={line.title} style={styles.helpRow}>
            <View style={styles.helpBadge}>
              <Text style={styles.helpBadgeText}>{index + 1}</Text>
            </View>
            <Text style={styles.helpText}>
              <Text style={styles.helpTextStrong}>{line.title}:</Text> {line.detail}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.gray500,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.white,
    minHeight: 88,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapInboxActive: {
    backgroundColor: colors.purple600,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.red500,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  help: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  helpTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  helpRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  helpBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  helpBadgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
  helpText: {
    ...typography.bodySmall,
    color: colors.gray600,
    flex: 1,
  },
  helpTextStrong: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.gray900,
  },
});
