import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme/theme";
import { useApp } from "../data/AppContext";
import { getImportLimitMessage, isImportLimitReached } from "../data/usageLimits";

interface ImportFromLinkProps {
  onBack: () => void;
  onImport: (url: string) => Promise<void>;
}

export const ImportFromLink: React.FC<ImportFromLinkProps> = ({ onBack, onImport }) => {
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { plan, usageSummary, bonusImports, navigateTo } = useApp();
  const importLimitReached = isImportLimitReached(plan, usageSummary, bonusImports);
  const limitMessage = getImportLimitMessage(plan);
  const openPlans = () => navigateTo("planBilling");
  const showLimitAlert = () => {
    if (plan === "paid" || plan === "premium") {
      Alert.alert("Monthly limit reached", limitMessage, [
        { text: "Buy credits", onPress: openPlans },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    Alert.alert("Monthly limit reached", limitMessage, [
      { text: "Upgrade plan", onPress: openPlans },
      { text: "Buy credits", onPress: openPlans },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const detectedSource = useMemo(() => {
    const lower = url.toLowerCase();
    if (lower.includes("tiktok.com") || lower.includes("vm.tiktok.com")) return "TikTok";
    if (lower.includes("instagram.com") || lower.includes("instagr.am")) return "Instagram";
    if (lower.includes("pinterest.com") || lower.includes("pin.it")) return "Pinterest";
    if (lower.trim().length > 6) return "Website";
    return null;
  }, [url]);

  const importSteps = useMemo(() => {
    switch (detectedSource) {
      case "TikTok":
        return ["Opening the video", "Transcribing audio", "Checking the caption"];
      case "Instagram":
        return ["Opening the post", "Reading the caption", "Extracting recipe details"];
      case "Pinterest":
        return ["Opening the pin", "Following the source link", "Extracting the recipe"];
      case "Website":
        return ["Visiting the website", "Finding the recipe", "Extracting ingredients & steps"];
      default:
        return ["Opening the link", "Finding the recipe", "Extracting the details"];
    }
  }, [detectedSource]);

  const isValidUrl = url.trim().length > 0 && (url.includes("http") || url.includes("www"));

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    }
  };

  const handleImport = async () => {
    if (!isValidUrl || isImporting) return;
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    setIsImporting(true);
    setProgress(15);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    try {
      await onImport(url.trim());
      setProgress(100);
    } finally {
      clearInterval(progressInterval);
      setIsImporting(false);
      setProgress(0);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Import from Link</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.centerBlock}>
          <View style={styles.iconCircle}>
            <Ionicons name="link" size={36} color={colors.white} />
          </View>
          <Text style={styles.title}>Paste any recipe link</Text>
          <Text style={styles.subtitle}>
            We'll automatically detect if it's from TikTok, Instagram, Pinterest, or any recipe website.
          </Text>
        </View>

        <View style={styles.inputBlock}>
          <Text style={styles.label}>Recipe URL</Text>
          <View style={styles.inputWrap}>
            <TextInput
              placeholder="https://..."
              placeholderTextColor={colors.gray500}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              style={styles.input}
            />
            <Pressable onPress={handlePaste} style={styles.pasteButton}>
              <Text style={styles.pasteText}>Paste</Text>
            </Pressable>
          </View>
          {detectedSource && (
            <View style={styles.detectedRow}>
              <Ionicons name="sparkles-outline" size={16} color={colors.gray600} />
              <Text style={styles.detectedText}>
                Detected: <Text style={styles.detectedBold}>{detectedSource}</Text>
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            !isValidUrl || isImporting ? styles.primaryButtonDisabled : null,
          ]}
          onPress={handleImport}
          disabled={!isValidUrl || isImporting}
        >
          {isImporting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.primaryButtonText}>Importing...</Text>
            </View>
          ) : (
            <Text style={[styles.primaryButtonText, !isValidUrl ? styles.primaryButtonTextDisabled : null]}>
              Import Recipe
            </Text>
          )}
        </Pressable>
        {importLimitReached && (
          <Text style={styles.limitNote}>
            {limitMessage}
          </Text>
        )}

        {isImporting && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={colors.gray900} />
              <Text style={styles.progressTitle}>Processing your recipe...</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(95, Math.max(progress, 10))}%` }]} />
            </View>
            <Text style={styles.progressHint}>Here’s what’s happening:</Text>
            <View style={styles.progressSteps}>
              {importSteps.map((step) => (
                <Text key={step} style={styles.progressStepText}>
                  • {step}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>How to get the link</Text>
          {[
            {
              title: "Find a recipe",
              subtitle: "On TikTok, Instagram, Pinterest, or any recipe blog.",
            },
            {
              title: "Copy the link",
              subtitle: "Tap Share → Copy Link in the app or copy from the address bar.",
            },
            {
              title: "Paste above",
              subtitle: "We'll extract the recipe and let you edit it before saving.",
            },
          ].map((item, index) => (
            <View key={item.title} style={styles.helpRow}>
              <View style={styles.helpBadge}>
                <Text style={styles.helpBadgeText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.helpRowTitle}>{item.title}</Text>
                <Text style={styles.helpRowSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    gap: spacing.md,
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
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  centerBlock: {
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
    maxWidth: 320,
  },
  inputBlock: {
    gap: spacing.sm,
  },
  label: {
    ...typography.captionBold,
    color: colors.gray700,
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingRight: 80,
    ...typography.body,
    minHeight: 44,
  },
  pasteButton: {
    position: "absolute",
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pasteText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  detectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  detectedText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  detectedBold: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  primaryButton: {
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  primaryButtonText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  primaryButtonTextDisabled: {
    color: colors.gray400,
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
  progressCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressTitle: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.purple600,
  },
  progressHint: {
    ...typography.caption,
    color: colors.gray500,
  },
  progressSteps: {
    gap: spacing.xs,
  },
  progressStepText: {
    ...typography.caption,
    color: colors.gray700,
  },
  helpCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  helpTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  helpRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  helpBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  helpBadgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
  helpRowTitle: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.gray900,
  },
  helpRowSubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    marginTop: 2,
  },
  supported: {
    gap: spacing.sm,
    alignItems: "center",
  },
  supportedLabel: {
    ...typography.caption,
    color: colors.gray400,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  supportedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  platformChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
  },
  platformIcon: {
    ...typography.bodySmall,
  },
  platformText: {
    ...typography.captionBold,
    color: colors.gray600,
  },
});
