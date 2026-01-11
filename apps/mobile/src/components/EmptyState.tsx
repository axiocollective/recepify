import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadow, spacing } from "../theme/theme";

interface EmptyStateProps {
  variant: "home" | "myRecipes";
  userName?: string;
  onImportFromLink: () => void;
  onScanRecipe: () => void;
  onAddManually: () => void;
  onCheckInbox?: () => void;
  inboxCount?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant,
  userName,
  onImportFromLink,
  onScanRecipe,
  onAddManually,
  onCheckInbox,
  inboxCount = 0,
}) => {
  const showInbox = Boolean(onCheckInbox);
  const title = variant === "home" ? `Welcome ${userName ?? "there"}` : "Start Your Collection";
  const subtitle =
    variant === "home"
      ? "Your personal cookbook awaits"
      : "Import recipes from anywhere—cookbooks, websites, or create your own from scratch";
  return (
    <View style={[styles.container, variant === "home" ? styles.homeContainer : styles.myRecipesContainer]}>
      <Text style={styles.homeTitle}>{title}</Text>
      <Text style={styles.homeSubtitle}>{subtitle}</Text>

      <View style={styles.actionGroup}>
        <Pressable onPress={onImportFromLink}>
          <LinearGradient
            colors={["#a855f7", "#9333ea"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryButton, shadow.lg]}
          >
            <Ionicons name="link-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Import from Link</Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onScanRecipe}>
          <Ionicons name="camera-outline" size={18} color={colors.gray600} />
          <Text style={styles.secondaryButtonText}>Scan Recipe</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onAddManually}>
          <Ionicons name="add" size={20} color={colors.gray600} />
          <Text style={styles.secondaryButtonText}>Create Manually</Text>
        </Pressable>

        {showInbox && (
          <Pressable style={styles.inboxButton} onPress={onCheckInbox}>
            <Ionicons name="mail-outline" size={18} color={colors.purple600} />
            <Text style={styles.inboxButtonText}>Check Inbox</Text>
            {inboxCount > 0 && (
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>{inboxCount}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  homeContainer: {
    minHeight: 520,
    backgroundColor: colors.gray50,
  },
  myRecipesContainer: {
    minHeight: 480,
    backgroundColor: colors.white,
  },
  homeTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: colors.gray900,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  homeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray500,
    textAlign: "center",
    marginBottom: spacing.xxl,
    maxWidth: 320,
  },
  actionGroup: {
    width: "100%",
    maxWidth: 360,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.white,
  },
  secondaryButton: {
    height: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.gray900,
  },
  inboxButton: {
    height: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: "#e9d5ff",
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  inboxButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.gray900,
  },
  inboxBadge: {
    position: "absolute",
    top: 8,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
  },
  inboxBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
