import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, shadow, spacing } from "../theme/theme";
import { useApp } from "../data/AppContext";
import { getImportLimitMessage, getImportLimitTitle, isImportLimitReached } from "../data/usageLimits";

interface ScanRecipeProps {
  onBack: () => void;
  onScan: (imageData: string[]) => Promise<void>;
}

const MAX_IMAGES = 2;
const MOCK_GALLERY_IMAGES = [
  "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=200&fit=crop",
];

export const ScanRecipe: React.FC<ScanRecipeProps> = ({ onBack, onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recentGalleryImages, setRecentGalleryImages] = useState<string[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const didAutoTrigger = useRef(false);
  const { plan, usageSummary, addonImports, trialActive, trialImportsRemaining, navigateTo } = useApp();
  const importLimitReached = isImportLimitReached(plan, usageSummary, trialActive, addonImports, trialImportsRemaining);
  const limitMessage = getImportLimitMessage(plan);
  const openPlans = () => navigateTo("planBilling", { focus: "credits" });
  const limitTitle = getImportLimitTitle(plan);
  const canAddMore = capturedImages.length < MAX_IMAGES;

  const showLimitAlert = () => {
    Alert.alert(limitTitle, limitMessage, [
      { text: "Buy more", onPress: openPlans },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  useEffect(() => {
    setRecentGalleryImages(MOCK_GALLERY_IMAGES);
  }, []);

  useEffect(() => {
    if (!isScanning) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isScanning, pulseAnim]);

  const startScanning = async (images: string[]) => {
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    if (!images.length) return;
    setIsScanning(true);
    setError(null);
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
      } catch (scanError) {
        const message = scanError instanceof Error ? scanError.message : "Failed to scan recipe. Please try again.";
        setError(message);
      } finally {
        setIsScanning(false);
        setProgress(0);
      }
    }, 2200);
  };

  const handleTakePhoto = useCallback(async () => {
    if (importLimitReached) {
      showLimitAlert();
      return;
    }
    if (isScanning) return;
    if (capturedImages.length >= MAX_IMAGES) {
      Alert.alert("Limit reached", "You can scan up to 2 photos at a time.");
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
        setCapturedImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_IMAGES));
      }
    } catch {
      Alert.alert("Camera unavailable", "Please choose a photo from your library instead.");
      void handleChooseFromGallery();
    }
  }, [capturedImages.length, importLimitReached, isScanning]);

  const handleChooseFromGallery = useCallback(async () => {
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
      selectionLimit: Math.max(1, MAX_IMAGES - capturedImages.length),
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      const next = result.assets.map((asset) => asset.uri).filter(Boolean);
      setCapturedImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    }
  }, [capturedImages.length, importLimitReached, isScanning]);

  useEffect(() => {
    if (didAutoTrigger.current) return;
    didAutoTrigger.current = true;
    const timer = setTimeout(() => {
      if (canAddMore && !isScanning) {
        void handleTakePhoto();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [canAddMore, handleTakePhoto, isScanning]);

  const handleGalleryImageClick = (imageUrl: string) => {
    if (!canAddMore || isScanning) return;
    setCapturedImages((prev) => {
      if (prev.includes(imageUrl)) return prev;
      return [...prev, imageUrl].slice(0, MAX_IMAGES);
    });
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const helperText = canAddMore
    ? `You can add ${MAX_IMAGES - capturedImages.length} more photo${MAX_IMAGES - capturedImages.length > 1 ? "s" : ""}`
    : "Maximum photos reached";

  return (
    <View style={styles.container}>
      <View style={styles.cameraArea}>
        {capturedImages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="camera" size={40} color={colors.white} />
            </View>
            <Text style={styles.emptyTitle}>Scan your recipe</Text>
            <Text style={styles.emptySubtitle}>
              Capture up to 2 photos of your recipe card, cookbook page, or handwritten notes.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.previewContent}>
            {capturedImages.map((image, index) => (
              <View key={`${image}-${index}`} style={styles.previewCard}>
                <Image source={{ uri: image }} style={styles.previewImage} resizeMode="contain" />
                <Pressable style={styles.previewRemove} onPress={() => removeImage(index)}>
                  <Ionicons name="close" size={18} color={colors.white} />
                </Pressable>
                <View style={styles.previewLabel}>
                  <Text style={styles.previewLabelText}>{`Photo ${index + 1}`}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <LinearGradient colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]} style={styles.headerOverlay}>
          <SafeAreaView>
            <View style={styles.headerRow}>
              <Pressable style={styles.backButton} onPress={onBack}>
                <Ionicons name="arrow-back" size={20} color={colors.white} />
              </Pressable>
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{`${capturedImages.length}/${MAX_IMAGES}`}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {isScanning && (
          <View style={styles.scanningOverlay}>
            <View style={styles.scanningCard}>
              <Animated.View style={[styles.scanningIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="sparkles" size={24} color={colors.white} />
              </Animated.View>
              <View style={styles.scanningCopy}>
                <Text style={styles.scanningTitle}>Scanning recipe...</Text>
                <Text style={styles.scanningSubtitle}>AI is extracting details</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(Math.max(progress, 0), 100)}%` }]} />
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {canAddMore && (
        <View style={styles.gallerySection}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Recent Photos</Text>
            <Pressable onPress={handleChooseFromGallery}>
              <Text style={styles.galleryAction}>View All</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
            {recentGalleryImages.map((image) => {
              const isSelected = capturedImages.includes(image);
              return (
                <Pressable
                  key={image}
                  onPress={() => handleGalleryImageClick(image)}
                  disabled={!canAddMore || isScanning}
                  style={[
                    styles.galleryItem,
                    isSelected && styles.galleryItemSelected,
                    (!canAddMore || isScanning) && styles.galleryItemDisabled,
                  ]}
                >
                  <Image source={{ uri: image }} style={styles.galleryImage} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.bottomBar}>
        <View style={styles.actionRow}>
          {canAddMore && (
            <Pressable
              style={[styles.actionButton, styles.addButton, isScanning && styles.actionDisabled]}
              onPress={handleTakePhoto}
              disabled={isScanning}
            >
              <Ionicons name="camera-outline" size={18} color={colors.white} />
              <Text style={styles.actionText}>Add Photo</Text>
            </Pressable>
          )}
          {capturedImages.length > 0 && (
            <Pressable
              style={[styles.actionButton, styles.scanButton, isScanning && styles.actionDisabled]}
              onPress={() => startScanning(capturedImages)}
              disabled={isScanning}
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.scanText}>
                {`Scan ${capturedImages.length} Photo${capturedImages.length > 1 ? "s" : ""}`}
              </Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.helperText}>{helperText}</Text>
      </View>

      {error && (
        <View style={styles.errorToast}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.white} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.errorClose} onPress={() => setError(null)}>
            <Ionicons name="close" size={14} color={colors.white} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraArea: {
    flex: 1,
    backgroundColor: "#0f172a",
    position: "relative",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  counterBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  counterText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.white,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  previewContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: "center",
  },
  previewCard: {
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.gray800,
  },
  previewImage: {
    width: "100%",
    height: 320,
  },
  previewRemove: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  previewLabel: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  previewLabelText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.white,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  scanningCard: {
    width: "100%",
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadow.lg,
  },
  scanningIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9333ea",
  },
  scanningCopy: {
    flex: 1,
  },
  scanningTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
  },
  scanningSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#9333ea",
  },
  gallerySection: {
    backgroundColor: "rgba(0,0,0,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  galleryTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  galleryAction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#c084fc",
  },
  galleryScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  galleryItem: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  galleryItemSelected: {
    borderColor: "#a855f7",
  },
  galleryItemDisabled: {
    opacity: 0.5,
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  bottomBar: {
    backgroundColor: "rgba(0,0,0,0.95)",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  scanButton: {
    backgroundColor: "#9333ea",
    ...shadow.lg,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.white,
  },
  scanText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.white,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: spacing.md,
  },
  errorToast: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 132,
    borderRadius: radius.lg,
    backgroundColor: colors.red500,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  errorClose: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
