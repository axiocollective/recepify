import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, typography } from "../theme/theme";

interface RecipeImportLoadingProps {
  source: "tiktok" | "instagram" | "pinterest" | "youtube" | "web" | "scan";
  onComplete: () => void;
  duration?: number;
}

interface StepConfig {
  id: string;
  text: string;
  duration: number;
  icon: keyof typeof Ionicons.glyphMap;
}

const SOURCE_STEPS: Record<RecipeImportLoadingProps["source"], StepConfig[]> = {
  tiktok: [
    { id: "connect", text: "Connecting to TikTok...", duration: 2000, icon: "link-outline" },
    { id: "download", text: "Downloading video content...", duration: 3000, icon: "image-outline" },
    { id: "ai", text: "AI is watching the video...", duration: 4000, icon: "sparkles" },
    { id: "extract", text: "Extracting recipe details...", duration: 3500, icon: "document-text-outline" },
    { id: "format", text: "Formatting your recipe...", duration: 2500, icon: "restaurant-outline" },
  ],
  instagram: [
    { id: "connect", text: "Connecting to Instagram...", duration: 2000, icon: "link-outline" },
    { id: "fetch", text: "Fetching post content...", duration: 3000, icon: "image-outline" },
    { id: "ai", text: "AI is reading the caption...", duration: 4000, icon: "sparkles" },
    { id: "identify", text: "Identifying ingredients & steps...", duration: 3500, icon: "document-text-outline" },
    { id: "organize", text: "Organizing your recipe...", duration: 2500, icon: "restaurant-outline" },
  ],
  pinterest: [
    { id: "connect", text: "Connecting to Pinterest...", duration: 2000, icon: "link-outline" },
    { id: "load", text: "Loading pin details...", duration: 3000, icon: "image-outline" },
    { id: "analyze", text: "AI is analyzing the pin...", duration: 3500, icon: "sparkles" },
    { id: "extract", text: "Extracting recipe content...", duration: 4000, icon: "document-text-outline" },
    { id: "finalize", text: "Finalizing your recipe...", duration: 2500, icon: "restaurant-outline" },
  ],
  youtube: [
    { id: "connect", text: "Connecting to YouTube...", duration: 2000, icon: "link-outline" },
    { id: "description", text: "Reading the description and captions...", duration: 3000, icon: "document-text-outline" },
    { id: "video", text: "Checking the video for key moments...", duration: 3500, icon: "play-outline" },
    { id: "extract", text: "Extracting recipe details...", duration: 4000, icon: "sparkles" },
    { id: "finalize", text: "Finalizing your recipe...", duration: 2500, icon: "restaurant-outline" },
  ],
  web: [
    { id: "open", text: "Opening recipe page...", duration: 2000, icon: "link-outline" },
    { id: "scan", text: "Scanning webpage content...", duration: 3000, icon: "image-outline" },
    { id: "analyze", text: "AI is analyzing the recipe...", duration: 4000, icon: "sparkles" },
    { id: "structure", text: "Structuring ingredients & steps...", duration: 3500, icon: "document-text-outline" },
    { id: "card", text: "Creating your recipe card...", duration: 2500, icon: "restaurant-outline" },
  ],
  scan: [
    { id: "upload", text: "Uploading your photo...", duration: 2000, icon: "image-outline" },
    { id: "detect", text: "Detecting text and layout...", duration: 3000, icon: "scan-outline" },
    { id: "read", text: "AI is reading the recipe...", duration: 4000, icon: "sparkles" },
    { id: "extract", text: "Extracting ingredients & steps...", duration: 3500, icon: "document-text-outline" },
    { id: "format", text: "Formatting your recipe...", duration: 2500, icon: "restaurant-outline" },
  ],
};

export const RecipeImportLoading: React.FC<RecipeImportLoadingProps> = ({
  source,
  onComplete,
  duration,
}) => {
  const baseSteps = SOURCE_STEPS[source] ?? [];
  const baseTotal = useMemo(
    () => baseSteps.reduce((sum, step) => sum + step.duration, 0),
    [baseSteps]
  );
  const steps = useMemo(() => {
    if (!baseSteps.length) return [];
    const scale = duration && baseTotal > 0 ? duration / baseTotal : 1;
    return baseSteps.map((step) => ({ ...step, duration: step.duration * scale }));
  }, [baseSteps, baseTotal, duration]);
  const cumulativeDurations = useMemo(() => {
    let running = 0;
    return steps.map((step) => {
      running += step.duration;
      return running;
    });
  }, [steps]);
  const [elapsed, setElapsed] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!steps.length) return undefined;
    const start = Date.now();
    const timer = setInterval(() => {
      const nextElapsed = duration ? Math.min(Date.now() - start, duration) : Date.now() - start;
      setElapsed(nextElapsed);
    }, 50);
    return () => {
      clearInterval(timer);
    };
  }, [duration, steps.length]);

  useEffect(() => {
    if (!duration) return undefined;
    const completionTimer = setTimeout(() => {
      onComplete();
    }, duration + 500);
    return () => clearTimeout(completionTimer);
  }, [duration, onComplete]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const currentStepIndex = useMemo(() => {
    if (!steps.length) return -1;
    const index = cumulativeDurations.findIndex((value) => elapsed < value);
    return index === -1 ? steps.length - 1 : index;
  }, [cumulativeDurations, elapsed, steps.length]);

  useEffect(() => {
    textAnim.setValue(0);
    Animated.timing(textAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [currentStepIndex, textAnim]);

  if (!steps.length || currentStepIndex < 0) {
    return null;
  }

  const currentStep = steps[currentStepIndex];
  const progress = duration
    ? Math.min(100, Math.round((elapsed / duration) * 100))
    : Math.min(95, Math.round((elapsed / Math.max(baseTotal, 1)) * 95));
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const textTranslate = textAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <View style={styles.currentStepBlock}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseScale }] }]}>
            <LinearGradient
              colors={[colors.purple500, colors.purple600]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name={currentStep.icon} size={20} color={colors.white} />
            </LinearGradient>
          </Animated.View>
          <Animated.View style={{ opacity: textAnim, transform: [{ translateY: textTranslate }] }}>
            <Text style={styles.currentTitle}>{currentStep.text}</Text>
          </Animated.View>
          <Text style={styles.currentSubtitle}>This might take a few seconds</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[colors.purple500, colors.purple600]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressLabel}>{progress}% complete</Text>
        </View>

        <View style={styles.stepList}>
          {steps.map((step, index) => {
            const isCompleted =
              elapsed >= (cumulativeDurations[index] ?? 0)
              && (duration ? true : index < steps.length - 1);
            const isCurrent = index === currentStepIndex && !isCompleted;
            return (
              <View
                key={step.id}
                style={[
                  styles.stepItem,
                  isCompleted && styles.stepItemCompleted,
                  isCurrent && styles.stepItemCurrent,
                ]}
              >
                <View
                  style={[
                    styles.stepBadge,
                    isCompleted && styles.stepBadgeCompleted,
                    isCurrent && styles.stepBadgeCurrent,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color={colors.white} />
                  ) : (
                    <Text
                      style={[
                        styles.stepNumber,
                        isCurrent && styles.stepNumberCurrent,
                        !isCurrent && styles.stepNumberPending,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepText,
                    isCompleted && styles.stepTextCompleted,
                    isCurrent && styles.stepTextCurrent,
                  ]}
                >
                  {step.text}
                </Text>
                {isCurrent && (
                  <Animated.View style={[styles.spinner, { transform: [{ rotate: spinRotate }] }]} />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.tipContainer}>
          <Text style={styles.tipText}>💡 Tip: You can edit any imported recipe before saving</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  currentStepBlock: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    marginBottom: 20,
    overflow: "hidden",
  },
  iconGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  currentTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.gray900,
    textAlign: "center",
    marginBottom: 8,
  },
  currentSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
  },
  progressSection: {
    width: "100%",
    maxWidth: 320,
    marginBottom: 32,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  progressLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray400,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  stepList: {
    width: "100%",
    maxWidth: 384,
    gap: 10,
  },
  stepItem: {
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: colors.gray50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepItemCompleted: {
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  stepItemCurrent: {
    borderColor: colors.purple500,
    backgroundColor: colors.purple100,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray200,
  },
  stepBadgeCompleted: {
    backgroundColor: colors.purple600,
  },
  stepBadgeCurrent: {
    backgroundColor: colors.purple100,
  },
  stepNumber: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.gray400,
  },
  stepNumberCurrent: {
    color: colors.purple600,
  },
  stepNumberPending: {
    color: colors.gray400,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.gray500,
    flex: 1,
  },
  stepTextCompleted: {
    color: colors.gray400,
    textDecorationLine: "line-through",
  },
  stepTextCurrent: {
    color: colors.gray900,
    fontWeight: "500",
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.purple600,
    borderTopColor: "transparent",
  },
  tipContainer: {
    marginTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray400,
    textAlign: "center",
  },
});
