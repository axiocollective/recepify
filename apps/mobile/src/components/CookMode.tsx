import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Recipe } from "../data/types";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";

interface CookModeProps {
  recipe: Recipe;
  onExit: () => void;
}

const timerPresets = [3, 5, 15];

export const CookMode: React.FC<CookModeProps> = ({ recipe, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSettingTimer, setIsSettingTimer] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(10);
  const [showCompletion, setShowCompletion] = useState(false);
  const detectDefaultUnit = () => {
    const text = recipe.ingredients.map((ingredient) => ingredient.amount ?? "").join(" ").toLowerCase();
    return /(g|kg|ml|l|°c)\b/.test(text) ? "metric" : "us";
  };
  const [currentServings, setCurrentServings] = useState(recipe.servingsOverride ?? recipe.servings ?? 1);
  const [unitSystem, setUnitSystem] = useState<"metric" | "us">(recipe.unitSystem ?? detectDefaultUnit());
  const [showIngredients, setShowIngredients] = useState(false);

  useEffect(() => {
    if (!isTimerRunning || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const progress = useMemo(() => ((currentStep + 1) / recipe.steps.length) * 100, [currentStep, recipe.steps.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startTimer = (minutes: number) => {
    setTimerSeconds(minutes * 60);
    setIsTimerRunning(true);
    setIsSettingTimer(false);
  };

  const toggleTimer = () => setIsTimerRunning((prev) => !prev);
  const resetTimer = () => {
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setIsSettingTimer(false);
  };

  useEffect(() => {
    setCurrentServings(recipe.servingsOverride ?? recipe.servings ?? 1);
    setUnitSystem(recipe.unitSystem ?? detectDefaultUnit());
  }, [recipe.id, recipe.servingsOverride, recipe.servings, recipe.unitSystem]);

  const parseQuantity = (value: string): number | null => {
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.includes("-")) return null;
    const fractionMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const whole = Number(fractionMatch[1]);
      const numerator = Number(fractionMatch[2]);
      const denominator = Number(fractionMatch[3]);
      if (denominator) {
        return whole + numerator / denominator;
      }
    }
    const simpleFraction = normalized.match(/^(\d+)\/(\d+)$/);
    if (simpleFraction) {
      const numerator = Number(simpleFraction[1]);
      const denominator = Number(simpleFraction[2]);
      if (denominator) {
        return numerator / denominator;
      }
    }
    const numeric = Number(normalized.replace(",", "."));
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    return null;
  };

  const parseAmountParts = (amount: string) => {
    const match = amount.trim().match(
      /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?$/i
    );
    if (!match) return null;
    const quantity = parseQuantity(match[1]);
    if (quantity === null) return null;
    const unitRaw = (match[2] || "").toLowerCase();
    return { quantity, unitRaw };
  };

  const normalizeUnit = (unitRaw: string): string | null => {
    const map: Record<string, string> = {
      g: "g",
      gram: "g",
      grams: "g",
      kg: "kg",
      kilogram: "kg",
      kilograms: "kg",
      ml: "ml",
      milliliter: "ml",
      milliliters: "ml",
      l: "l",
      liter: "l",
      litre: "l",
      liters: "l",
      litres: "l",
      oz: "oz",
      ounce: "oz",
      ounces: "oz",
      lb: "lb",
      lbs: "lb",
      pound: "lb",
      pounds: "lb",
      cup: "cup",
      cups: "cup",
      tbsp: "tbsp",
      tablespoon: "tbsp",
      tablespoons: "tbsp",
      tsp: "tsp",
      teaspoon: "tsp",
      teaspoons: "tsp",
      "fl oz": "fl oz",
    };
    return map[unitRaw] || null;
  };

  const formatQuantity = (value: number) => {
    if (value >= 100) return `${Math.round(value)}`;
    if (value >= 10) return `${Math.round(value * 10) / 10}`;
    return `${Math.round(value * 100) / 100}`;
  };

  const scaleAmount = (amount: string, targetServings: number, baseServings: number) => {
    const parts = parseAmountParts(amount);
    if (!parts || !baseServings) return amount;
    const scaled = (parts.quantity / baseServings) * targetServings;
    const unitSuffix = parts.unitRaw ? ` ${parts.unitRaw}` : "";
    return `${formatQuantity(scaled)}${unitSuffix}`;
  };

  const convertAmount = (amount: string, toUnitSystem: "metric" | "us") => {
    const parts = parseAmountParts(amount);
    if (!parts) return amount;
    const unit = normalizeUnit(parts.unitRaw || "");
    if (!unit) return amount;

    const value = parts.quantity;

    if (toUnitSystem === "us") {
      if (["g", "kg", "ml", "l"].includes(unit)) {
        const grams = unit === "g" ? value : unit === "kg" ? value * 1000 : unit === "ml" ? value : value * 1000;
        return `${formatQuantity(grams * 0.035274)} oz`;
      }
      if (unit === "oz") {
        return `${formatQuantity(value)} oz`;
      }
      if (unit === "lb") {
        return `${formatQuantity(value)} lb`;
      }
      if (unit === "cup") return `${formatQuantity(value)} cup`;
      if (unit === "tbsp") return `${formatQuantity(value)} tbsp`;
      if (unit === "tsp") return `${formatQuantity(value)} tsp`;
      if (unit === "fl oz") return `${formatQuantity(value)} fl oz`;
      return amount;
    }

    if (toUnitSystem === "metric") {
      if (["oz", "lb", "cup", "tbsp", "tsp", "fl oz"].includes(unit)) {
        if (unit === "oz") return `${formatQuantity(value * 28.3495)} g`;
        if (unit === "lb") return `${formatQuantity(value * 453.592)} g`;
        if (unit === "cup") return `${formatQuantity(value * 240)} ml`;
        if (unit === "tbsp") return `${formatQuantity(value * 15)} ml`;
        if (unit === "tsp") return `${formatQuantity(value * 5)} ml`;
        if (unit === "fl oz") return `${formatQuantity(value * 29.5735)} ml`;
      }
      if (unit === "g") return `${formatQuantity(value)} g`;
      if (unit === "kg") return `${formatQuantity(value)} kg`;
      if (unit === "ml") return `${formatQuantity(value)} ml`;
      if (unit === "l") return `${formatQuantity(value)} l`;
      return amount;
    }

    return amount;
  };

  const formatIngredientAmount = (amount: string) => {
    if (!amount) return "";
    const scaled = scaleAmount(amount, currentServings, recipe.servings || 1);
    return convertAmount(scaled, unitSystem);
  };

  const completionMessages = useMemo(
    () => [
      "That’s a wrap! Time to enjoy your masterpiece 😋",
      "Cooking complete. Forks ready? Enjoy! 🍴✨",
      "Well done, Chef! Now comes the best part 😌🍽️",
      "Mission accomplished. Bon appétit! 🎉🥂",
      "You did it! Go enjoy every bite 🤍🍝",
      "Kitchen closed. Happiness served 😄🍲",
      "From pan to plate — enjoy your meal! 😍",
      "Cooking mode off. Eating mode on 😎🍴",
      "Smells amazing, right? Enjoy your meal! 🤤✨",
      "ChefGPT approves. Now go eat! 😄🍽️",
    ],
    []
  );
  const completionMessage = useMemo(() => {
    if (!recipe.id) return completionMessages[0];
    const seed = recipe.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return completionMessages[seed % completionMessages.length];
  }, [completionMessages, recipe.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerMeta}>Cook Mode</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
        </View>
        <Pressable onPress={onExit} style={styles.headerButton}>
          <Ionicons name="close" size={20} color={colors.gray900} />
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Step {currentStep + 1} of {recipe.steps.length}
          </Text>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{currentStep + 1}</Text>
        </View>
        <Text style={styles.stepDescription}>{recipe.steps[currentStep]}</Text>

        {timerSeconds > 0 && (
          <LinearGradient
            colors={[colors.purple500, colors.purple600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.timerCard}
          >
            <View style={styles.timerHeader}>
              <View style={styles.timerHeaderLeft}>
                <Ionicons name="timer-outline" size={18} color={colors.white} />
                <Text style={styles.timerLabel}>Timer</Text>
              </View>
              <Pressable onPress={resetTimer} style={styles.timerReset}>
                <Ionicons name="close" size={16} color={colors.white} />
              </Pressable>
            </View>
            <View style={styles.timerCenter}>
              <Text style={styles.timerValue}>{formatTime(timerSeconds)}</Text>
            </View>
            <Pressable style={styles.timerAction} onPress={toggleTimer}>
              <Ionicons name={isTimerRunning ? "pause" : "play"} size={18} color={colors.white} />
              <Text style={styles.timerActionText}>{isTimerRunning ? "Pause" : "Resume"}</Text>
            </Pressable>
          </LinearGradient>
        )}

        {timerSeconds === 0 && !isSettingTimer && (
          <View style={styles.quickTimers}>
            <View style={styles.quickTimersHeader}>
              <Text style={styles.quickTimersTitle}>Quick Timers</Text>
              <Pressable onPress={() => setIsSettingTimer(true)}>
                <Text style={styles.customLink}>Custom</Text>
              </Pressable>
            </View>
            <View style={styles.quickTimersRow}>
              {timerPresets.map((minutes) => (
                <Pressable key={minutes} style={styles.quickTimerChip} onPress={() => startTimer(minutes)}>
                  <Ionicons name="timer-outline" size={16} color={colors.gray600} />
                  <Text style={styles.quickTimerText}>{minutes}m</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {isSettingTimer && timerSeconds === 0 && (
          <View style={styles.customTimerCard}>
            <View style={styles.customHeader}>
              <Text style={styles.customTitle}>Set Custom Timer</Text>
              <Pressable onPress={() => setIsSettingTimer(false)}>
                <Text style={styles.customCancel}>Cancel</Text>
              </Pressable>
            </View>
            <View style={styles.customControls}>
              <Pressable onPress={() => setCustomMinutes((prev) => Math.max(1, prev - 1))} style={styles.customButton}>
                <Ionicons name="remove" size={18} color={colors.purple600} />
              </Pressable>
              <View style={styles.customValue}>
                <Text style={styles.customValueText}>{customMinutes}</Text>
                <Text style={styles.customValueUnit}>MIN</Text>
              </View>
              <Pressable onPress={() => setCustomMinutes((prev) => prev + 1)} style={styles.customButton}>
                <Ionicons name="add" size={18} color={colors.purple600} />
              </Pressable>
            </View>
            <Pressable style={styles.customStart} onPress={() => startTimer(customMinutes)}>
              <Text style={styles.customStartText}>Start {customMinutes} Minute Timer</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={styles.ingredientsToggle}
          onPress={() => setShowIngredients((prev) => !prev)}
        >
          <Text style={styles.ingredientsToggleText}>
            {showIngredients ? "Hide ingredients" : "See ingredients"}
          </Text>
        </Pressable>

        {showIngredients && (
          <View style={styles.ingredientsCard}>
            <View style={styles.ingredientsHeader}>
              <View style={styles.ingredientsHeaderLeft}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.purple600} />
                <Text style={styles.ingredientsTitle}>Ingredients</Text>
              </View>
              <View style={styles.unitToggle}>
                {(["metric", "us"] as const).map((unit) => (
                  <Pressable
                    key={unit}
                    style={[styles.unitChip, unitSystem === unit && styles.unitChipActive]}
                    onPress={() => setUnitSystem(unit)}
                  >
                    <Text style={[styles.unitChipText, unitSystem === unit && styles.unitChipTextActive]}>
                      {unit === "metric" ? "Metric" : "US"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.servingsRow}>
              <Text style={styles.adjustLabel}>Servings</Text>
              <View style={styles.servingsControls}>
                <Pressable
                  style={[styles.servingsButton, currentServings <= 1 && styles.servingsButtonDisabled]}
                  onPress={() => setCurrentServings((prev) => Math.max(1, prev - 1))}
                  disabled={currentServings <= 1}
                >
                  <Ionicons name="remove" size={14} color={colors.gray700} />
                </Pressable>
                <Text style={styles.servingsCount}>{currentServings}</Text>
                <Pressable style={styles.servingsButton} onPress={() => setCurrentServings((prev) => prev + 1)}>
                  <Ionicons name="add" size={14} color={colors.gray700} />
                </Pressable>
              </View>
            </View>
            {recipe.ingredients.map((ingredient, index) => (
              <View key={`${ingredient.name}-${index}`} style={styles.ingredientRow}>
                <Text style={styles.ingredientBullet}>•</Text>
                <Text style={styles.ingredientText}>
                  {ingredient.amount ? `${formatIngredientAmount(ingredient.amount)} ` : ""}
                  {ingredient.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.footerButton, currentStep === 0 && styles.footerButtonDisabled]}
          onPress={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
        >
          <Ionicons name="chevron-back" size={18} color={currentStep === 0 ? colors.gray400 : colors.gray900} />
          <Text style={[styles.footerButtonText, currentStep === 0 && styles.footerButtonTextDisabled]}>
            Back
          </Text>
        </Pressable>
        {currentStep < recipe.steps.length - 1 ? (
          <Pressable style={[styles.footerButtonPrimary, shadow.md]} onPress={() => setCurrentStep((prev) => prev + 1)}>
            <Text style={styles.footerButtonPrimaryText}>Next Step</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setShowCompletion(true)}>
            <LinearGradient colors={[colors.purple500, colors.purple600]} style={[styles.footerButtonPrimary, shadow.md]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.footerButtonPrimaryText}>Complete</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      {showCompletion && (
        <View style={styles.completionOverlay}>
          <View style={[styles.completionCard, shadow.lg]}>
            <View style={styles.completionIcon}>
              <Ionicons name="sparkles" size={22} color={colors.white} />
            </View>
            <Text style={styles.completionTitle}>All done!</Text>
            <Text style={styles.completionText}>{completionMessage}</Text>
            <Pressable
              style={[styles.completionButton, shadow.md]}
              onPress={() => {
                setShowCompletion(false);
                onExit();
              }}
            >
              <Text style={styles.completionButtonText}>Back to recipe</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.purple600,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  stepNumber: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  stepNumberText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.white,
  },
  stepDescription: {
    fontSize: 22,
    lineHeight: 32,
    color: colors.gray900,
    marginBottom: spacing.xxl,
  },
  timerCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  timerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timerLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.white,
  },
  timerReset: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerCenter: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  timerValue: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "700",
    color: colors.white,
  },
  timerAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    minHeight: 44,
  },
  timerActionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.white,
  },
  quickTimers: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickTimersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  quickTimersTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.gray900,
  },
  customLink: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.purple600,
  },
  quickTimersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickTimerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  quickTimerText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.gray700,
  },
  customTimerCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.purple100,
    backgroundColor: colors.gray50,
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  customHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  customCancel: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
    fontWeight: "500",
  },
  customControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  customButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  customValue: {
    alignItems: "center",
  },
  customValueText: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "800",
    color: colors.gray900,
  },
  customValueUnit: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.gray500,
    letterSpacing: 1,
  },
  customStart: {
    borderRadius: radius.lg,
    backgroundColor: colors.purple600,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  customStartText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.white,
  },
  adjustCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adjustLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.gray900,
  },
  servingsControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  servingsButton: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsButtonDisabled: {
    opacity: 0.5,
  },
  servingsCount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.gray900,
    minWidth: 28,
    textAlign: "center",
  },
  ingredientsToggle: {
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  ingredientsToggleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.purple600,
  },
  unitToggle: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  ingredientsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  unitChipActive: {
    backgroundColor: colors.purple600,
  },
  unitChipText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    fontWeight: "600",
  },
  unitChipTextActive: {
    color: colors.white,
  },
  ingredientsCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ede9fe",
    gap: spacing.sm,
  },
  ingredientsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  ingredientsTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.gray900,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  ingredientBullet: {
    color: colors.purple600,
    marginTop: 2,
  },
  ingredientText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray700,
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    flexDirection: "row",
    gap: spacing.md,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    minHeight: 50,
  },
  footerButtonDisabled: {
    backgroundColor: colors.gray100,
  },
  footerButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.gray900,
  },
  footerButtonTextDisabled: {
    color: colors.gray400,
  },
  footerButtonPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.gray900,
    minHeight: 50,
  },
  footerButtonPrimaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.white,
  },
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  completionCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    padding: spacing.xl,
    backgroundColor: colors.white,
    alignItems: "center",
    gap: spacing.md,
  },
  completionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
  },
  completionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: colors.gray900,
  },
  completionText: {
    ...typography.body,
    color: colors.gray600,
    textAlign: "center",
  },
  completionButton: {
    marginTop: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  completionButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
});
