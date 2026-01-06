import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing, typography } from "../theme/theme";
import { useApp } from "../data/AppContext";
import { getImportLimitMessage, getImportLimitTitle, isImportLimitReached } from "../data/usageLimits";

interface ScanRecipeProps {
  onBack: () => void;
  onScan: (imageData: string[]) => Promise<void>;
}

export const ScanRecipe: React.FC<ScanRecipeProps> = ({ onBack, onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
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

  const startScanning = async (images: string[]) => {
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    if (!images.length) return;
    setIsScanning(true);
    setProgress(15);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 600);

    setTimeout(async () => {
      clearInterval(progressInterval);
      setProgress(100);
      try {
        await onScan(images);
      } finally {
        setIsScanning(false);
        setProgress(0);
      }
    }, 2400);
  };

  const handleTakePhoto = async () => {
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    if (isScanning) return;
    if (selectedImages.length >= 3) {
      Alert.alert("Limit reached", "You can scan up to 3 photos at a time.");
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Camera access needed", "Please allow camera access to scan recipes.");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setSelectedImages((prev) => [...prev, result.assets[0].uri].slice(0, 3));
      }
    } catch {
      Alert.alert("Camera unavailable", "Please choose a photo from your library instead.");
      void handleChooseFromGallery();
    }
  };

  const handleChooseFromGallery = async () => {
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    if (isScanning) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Photos access needed", "Please allow photo library access to upload an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 3 - selectedImages.length),
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      const next = result.assets.map((asset) => asset.uri).filter(Boolean);
      setSelectedImages((prev) => [...prev, ...next].slice(0, 3));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Scan Recipe</Text>
        </View>
      </View>

      <View style={styles.body}>
        {selectedImages.length > 0 ? (
          <View style={styles.previewWrap}>
            <View style={styles.previewCard}>
              <View style={styles.previewGrid}>
                {selectedImages.map((image, index) => (
                  <View key={`${image}-${index}`} style={styles.previewItem}>
                    <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" />
                    <Pressable
                      style={styles.previewRemove}
                      onPress={() =>
                        setSelectedImages((prev) => prev.filter((_, idx) => idx !== index))
                      }
                    >
                      <Ionicons name="close" size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
              </View>
              {isScanning && (
                <View style={styles.scanningOverlay}>
                  <View style={styles.scanningCard}>
                    <View style={styles.scanningRow}>
                      <ActivityIndicator size="small" color={colors.gray900} />
                      <Text style={styles.scanningText}>
                        Scanning {selectedImages.length} photo{selectedImages.length > 1 ? "s" : ""}...
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(Math.max(progress, 0), 100)}%` }]} />
                    </View>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.previewActions}>
              {selectedImages.length < 3 && (
                <>
                  <Pressable style={styles.previewActionButton} onPress={handleTakePhoto}>
                    <Ionicons name="camera-outline" size={16} color={colors.gray700} />
                    <Text style={styles.previewActionText}>Add photo</Text>
                  </Pressable>
                  <Pressable style={styles.previewActionButton} onPress={handleChooseFromGallery}>
                    <Ionicons name="image-outline" size={16} color={colors.gray700} />
                    <Text style={styles.previewActionText}>Add from gallery</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
                onPress={() => startScanning(selectedImages)}
                disabled={isScanning}
              >
                <Text style={styles.scanButtonText}>
                  {isScanning ? "Scanning..." : `Scan ${selectedImages.length} photo${selectedImages.length > 1 ? "s" : ""}`}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.centerBlock}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={36} color={colors.white} />
              </View>
              <Text style={styles.title}>Scan anything</Text>
              <Text style={styles.subtitle}>
                Capture handwritten recipes from grandma, cookbook pages, recipe cards, or any printed recipe.
              </Text>
              <Text style={styles.caption}>Our AI will extract all the details for you.</Text>
            </View>

            <View style={styles.actionList}>
              <Pressable
                style={styles.actionCard}
                onPress={handleTakePhoto}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="camera-outline" size={20} color={colors.gray700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Take a photo</Text>
                  <Text style={styles.actionSubtitle}>Open camera to capture recipe</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={handleChooseFromGallery}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="image-outline" size={20} color={colors.gray700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Choose from gallery</Text>
                  <Text style={styles.actionSubtitle}>Select an existing photo</Text>
                </View>
              </Pressable>
            </View>
          </>
        )}
        {importLimitReached && (
          <Text style={styles.limitNote}>
            {limitMessage}
          </Text>
        )}

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
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  previewWrap: {
    marginBottom: spacing.lg,
  },
  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: "hidden",
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewItem: {
    width: "32%",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 110,
  },
  previewRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  previewActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  previewActionText: {
    ...typography.bodySmall,
    color: colors.gray700,
    fontWeight: "600",
  },
  scanButton: {
    borderRadius: radius.lg,
    backgroundColor: colors.gray900,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  scanningOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  scanningCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: "100%",
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scanningText: {
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
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
    maxWidth: 320,
  },
  caption: {
    ...typography.caption,
    color: colors.gray400,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  limitNote: {
    marginTop: spacing.lg,
    ...typography.caption,
    color: colors.gray500,
    textAlign: "center",
  },
  actionList: {
    gap: spacing.md,
  },
  actionCard: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 80,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  actionSubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    marginTop: 2,
  },
  tipsBlock: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  tipsTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  tipRow: {
    gap: 2,
  },
  tipTitle: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  tipSubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
});
