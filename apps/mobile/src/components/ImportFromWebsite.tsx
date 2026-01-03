import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme/theme";

interface ImportFromWebsiteProps {
  onBack: () => void;
}

export const ImportFromWebsite: React.FC<ImportFromWebsiteProps> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Import from Website</Text>
      </View>
      <View style={styles.body}>
        <Ionicons name="globe-outline" size={40} color={colors.gray500} />
        <Text style={styles.title}>Paste a link</Text>
        <Text style={styles.subtitle}>We support most recipe websites.</Text>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Paste URL</Text>
        </Pressable>
      </View>
    </View>
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
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.gray900,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
});
