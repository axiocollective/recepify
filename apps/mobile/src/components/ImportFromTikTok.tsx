import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme/theme";
import { useApp } from "../data/AppContext";
import { getImportLimitMessage, getImportLimitTitle, isImportLimitReached } from "../data/usageLimits";

interface ImportFromTikTokProps {
  onBack: () => void;
  onImport?: (url: string) => Promise<void>;
}

export const ImportFromTikTok: React.FC<ImportFromTikTokProps> = ({ onBack, onImport }) => {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { plan, usageSummary, bonusImports, trialActive, trialImportsRemaining, navigateTo } = useApp();
  const importLimitReached = isImportLimitReached(plan, usageSummary, bonusImports, trialImportsRemaining);
  const limitMessage = getImportLimitMessage(plan, trialActive);
  const openPlans = () => navigateTo("planBilling");
  const limitTitle = getImportLimitTitle(plan);
  const showLimitAlert = () => {
    if (plan === "paid" || plan === "premium") {
      Alert.alert(limitTitle, limitMessage, [
        { text: "Buy credits", onPress: openPlans },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    Alert.alert(limitTitle, limitMessage, [
      { text: "Buy credits", onPress: openPlans },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleCopyInstructions = async () => {
    await Clipboard.setStringAsync(
      "Open TikTok → Find recipe video → Tap Share → Copy Link → Return to Recipefy → Paste link"
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async () => {
    if (!url.trim() || !onImport || isImporting) return;
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Import from TikTok</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="logo-tiktok" size={32} color={colors.white} />
        </View>
        <View style={styles.centerBlock}>
          <Text style={styles.title}>Share from TikTok</Text>
          <Text style={styles.subtitle}>Import recipes directly from TikTok videos</Text>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsLabel}>How to import:</Text>
          {[
            "Open TikTok app",
            "Find the recipe video you want to save",
            "Tap the Share button",
            "Select 'Copy Link'",
            "Return here and paste the link below",
          ].map((text, index) => (
            <View key={text} style={styles.instructionRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{text}</Text>
            </View>
          ))}
          <Pressable onPress={handleCopyInstructions} style={styles.copyButton}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={14}
              color={colors.gray600}
            />
            <Text style={styles.copyButtonText}>{copied ? "Copied!" : "Copy instructions"}</Text>
          </Pressable>
        </View>

        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>TikTok Video Link</Text>
          <TextInput
            placeholder="https://www.tiktok.com/@username/video/..."
            placeholderTextColor={colors.gray500}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            style={styles.input}
          />
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
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.primaryButtonText}>Importing...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Import Recipe</Text>
            )}
          </Pressable>
        {importLimitReached && (
          <Text style={styles.limitNote}>
            {limitMessage}
          </Text>
        )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            <Text style={styles.infoStrong}>Tip:</Text> You can also use the system share sheet! Just tap
            "Share to Recipefy" directly from TikTok.
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
    backgroundColor: colors.black,
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
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  copyButtonText: {
    ...typography.caption,
    color: colors.gray600,
  },
  inputBlock: {
    gap: spacing.sm,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.gray600,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.bodySmall,
    minHeight: 44,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gray900,
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
  limitNote: {
    marginTop: spacing.md,
    ...typography.caption,
    color: colors.gray500,
    textAlign: "center",
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
