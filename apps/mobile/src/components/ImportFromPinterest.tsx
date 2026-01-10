import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme/theme";
import { useApp } from "../data/AppContext";
import { getImportLimitMessage, getImportLimitTitle, isImportLimitReached } from "../data/usageLimits";

interface ImportFromPinterestProps {
  onBack: () => void;
  onImport?: (url: string) => Promise<void>;
}

export const ImportFromPinterest: React.FC<ImportFromPinterestProps> = ({ onBack, onImport }) => {
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const { plan, usageSummary, addonImports, trialActive, trialImportsRemaining, navigateTo } = useApp();
  const importLimitReached = isImportLimitReached(plan, usageSummary, trialActive, addonImports, trialImportsRemaining);
  const limitMessage = getImportLimitMessage(plan);
  const openPlans = () => navigateTo("planBilling", { focus: "credits" });
  const limitTitle = getImportLimitTitle(plan);
  const showLimitAlert = () => {
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
  };

  const handleImport = async () => {
    if (!url.trim() || !onImport) return;
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    setIsImporting(true);
    try {
      await onImport(url.trim());
      setUrl("");
    } finally {
      setIsImporting(false);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Import from Pinterest</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="logo-pinterest" size={28} color={colors.white} />
        </View>
        <View style={styles.centerBlock}>
          <Text style={styles.title}>Share from Pinterest</Text>
          <Text style={styles.subtitle}>Import recipes from Pinterest pins</Text>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsLabel}>How to import:</Text>
          {[
            "Open Pinterest app or website",
            "Find the recipe pin you want to save",
            "Tap the Share button",
            "Select 'Copy Link'",
            "Paste the link below",
          ].map((text, index) => (
            <View key={text} style={styles.instructionRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.inputBlock}>
          <View style={styles.inputWrap}>
            <TextInput
              placeholder="https://pin.it/... or https://pinterest.com/pin/..."
              placeholderTextColor={colors.gray500}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              style={styles.input}
              editable={!isImporting}
            />
            <Pressable onPress={handlePaste} style={styles.pasteButton} disabled={isImporting}>
              <Text style={styles.pasteText}>Paste</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleImport}
            disabled={!url.trim() || isImporting}
            style={[
              styles.primaryButton,
              !url.trim() || isImporting ? styles.primaryButtonDisabled : null,
            ]}
          >
            {isImporting ? (
              <View style={styles.loadingRow}>
                <Ionicons name="reload" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>Importing...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Import Recipe</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            <Text style={styles.infoStrong}>Tip:</Text> We'll automatically follow the pin to the original recipe
            source and extract all the details.
          </Text>
        </View>
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
  body: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  iconCircle: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  centerBlock: {
    alignItems: "center",
  },
  title: {
    ...typography.h2,
    color: colors.gray900,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
  },
  instructions: {
    gap: spacing.md,
  },
  instructionsLabel: {
    ...typography.caption,
    color: colors.gray600,
  },
  instructionRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    ...typography.caption,
    color: colors.white,
  },
  instructionText: {
    ...typography.bodySmall,
    color: colors.gray700,
    flex: 1,
  },
  inputBlock: {
    gap: spacing.md,
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingRight: 88,
    ...typography.bodySmall,
    minHeight: 44,
  },
  pasteButton: {
    position: "absolute",
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pasteText: {
    ...typography.caption,
    color: colors.gray600,
  },
  primaryButton: {
    backgroundColor: colors.black,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  primaryButtonText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  infoText: {
    ...typography.caption,
    color: colors.gray600,
  },
  infoStrong: {
    ...typography.captionBold,
    color: colors.gray900,
  },
});
