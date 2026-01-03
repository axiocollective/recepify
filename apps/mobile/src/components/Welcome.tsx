import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface WelcomeProps {
  onLogin: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onLogin }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="chef-hat" size={64} color={colors.white} />
        </View>
        <Text style={styles.title}>Recipefy</Text>
        <Text style={styles.subtitle}>A home for all your recipes</Text>
      </View>

      <View style={styles.buttonStack}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
          <Ionicons name="logo-apple" size={20} color={colors.white} />
          <Text style={styles.primaryButtonText}>Sign in with Apple</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}>
          <Ionicons name="logo-google" size={20} color={colors.gray900} />
          <Text style={styles.secondaryButtonText}>Sign in with Google</Text>
        </Pressable>
        <Pressable
          onPress={onLogin}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
        >
          <Ionicons name="mail-outline" size={20} color={colors.gray400} />
          <Text style={styles.secondaryButtonText}>Sign in with Email</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    justifyContent: "center",
    gap: spacing.xxl,
  },
  topSection: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  logo: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: colors.gray900,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gray900,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  title: {
    ...typography.h1,
    color: colors.gray900,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.gray500,
    textAlign: "center",
  },
  buttonStack: {
    gap: spacing.md,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    ...shadow.lg,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  secondaryButtonText: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  secondaryPressed: {
    backgroundColor: colors.gray50,
  },
});
