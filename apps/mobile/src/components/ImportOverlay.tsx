import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";
import { Screen } from "../data/types";

interface ImportOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  onAddManually: () => void;
  inboxCount?: number;
}

export const ImportOverlay: React.FC<ImportOverlayProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onAddManually,
  inboxCount = 0,
}) => {
  const importOptions = [
    {
      id: "link",
      icon: "link-outline" as const,
      title: "From Link",
      description: "Paste a recipe URL from any website",
      action: () => {
        onNavigate("importFromLink");
        onClose();
      },
    },
    {
      id: "scan",
      icon: "camera-outline" as const,
      title: "Scan Recipe",
      description: "Take a photo of a recipe card or book",
      action: () => {
        onNavigate("scanRecipe");
        onClose();
      },
    },
    {
      id: "manual",
      icon: "create-outline" as const,
      title: "Create Manually",
      description: "Type your recipe from scratch",
      action: () => {
        onAddManually();
        onClose();
      },
    },
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Add Recipe</Text>
            <Text style={styles.subtitle}>Choose how to import</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.gray700} />
          </Pressable>
        </View>

        {inboxCount > 0 && (
          <Pressable
            style={styles.inboxWrap}
            onPress={() => {
              onNavigate("importInbox");
              onClose();
            }}
          >
            <LinearGradient
              colors={[colors.purple500, colors.purple600]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.inboxCard, shadow.md]}
            >
              <View style={styles.inboxIcon}>
                <Ionicons name="mail-outline" size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inboxTitle}>Inbox</Text>
                <Text style={styles.inboxSubtitle}>
                  {inboxCount} recipe{inboxCount !== 1 ? "s" : ""} waiting
                </Text>
              </View>
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>{inboxCount}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        <View style={styles.optionList}>
          {importOptions.map((option) => (
            <Pressable key={option.id} style={styles.option} onPress={option.action}>
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon} size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.bottomSpacer} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.gray900,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxWrap: {
    marginBottom: spacing.lg,
  },
  inboxCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  inboxIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  inboxTitle: {
    ...typography.bodyBold,
    color: colors.white,
  },
  inboxSubtitle: {
    ...typography.caption,
    color: "rgba(255,255,255,0.8)",
  },
  inboxBadge: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inboxBadgeText: {
    ...typography.bodyBold,
    color: colors.purple600,
  },
  optionList: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: 2,
  },
  bottomSpacer: {
    height: 32,
  },
});
