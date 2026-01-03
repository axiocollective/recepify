import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";

export const LoadingScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logo}>
        <MaterialCommunityIcons name="chef-hat" size={64} color={colors.white} />
      </View>
      <Text style={styles.text}>Loading...</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
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
  text: {
    ...typography.body,
    color: colors.gray500,
  },
});
