import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "black" | "white";
}

export const Logo: React.FC<LogoProps> = ({ size = "md", variant = "black" }) => {
  const fontSize = size === "lg" ? 28 : size === "sm" ? 18 : 22;
  const dotSize = size === "lg" ? 12 : size === "sm" ? 8 : 10;
  const color = variant === "white" ? colors.white : colors.gray900;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { width: dotSize, height: dotSize, backgroundColor: color }]} />
      <Text style={[styles.text, { fontSize, color }]} numberOfLines={1}>
        Recipefy
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    ...typography.h2,
    fontWeight: "600",
  },
  dot: {
    borderRadius: 999,
  },
});
