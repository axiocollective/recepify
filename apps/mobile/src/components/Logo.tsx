import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "black" | "white";
}

export const Logo: React.FC<LogoProps> = ({ size = "md", variant = "black" }) => {
  const fontSize = size === "lg" ? 24 : size === "sm" ? 18 : 22;
  const logoSize = size === "lg" ? 52 : size === "sm" ? 24 : 28;
  const color = variant === "white" ? colors.white : colors.gray900;

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/logo.png")}
        style={{ width: logoSize, height: logoSize }}
        resizeMode="contain"
      />
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
});
