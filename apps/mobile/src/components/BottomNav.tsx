import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BottomTab } from "../data/types";
import { colors, radius, spacing, typography, shadow } from "../theme/theme";

interface BottomNavProps {
  selected: BottomTab;
  onSelect: (tab: BottomTab) => void;
  importBadgeCount?: number;
}

const tabs: Array<{ id: BottomTab; label: string; icon: keyof typeof Ionicons.glyphMap; isPurple?: boolean }> = [
  { id: "home", label: "Home", icon: "home-outline" },
  { id: "myRecipes", label: "Recipes", icon: "book-outline" },
  { id: "import", label: "Import", icon: "download-outline" },
  { id: "shoppingList", label: "List", icon: "cart-outline" },
  { id: "profile", label: "Profile", icon: "person-outline" },
];

export const BottomNav: React.FC<BottomNavProps> = ({ selected, onSelect, importBadgeCount = 0 }) => {
  return (
    <View style={styles.container}>
      <View style={styles.backdrop} pointerEvents="none" />
      <View style={styles.inner}>
        {tabs.map((tab) => {
          const isSelected = selected === tab.id;
          const isPurple = tab.isPurple;
          return (
            <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={styles.tab}>
              {isPurple ? (
                <LinearGradient
                  colors={[colors.purple500, colors.purple600]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.purpleButton, shadow.lg]}
                >
                  <Ionicons name={tab.icon} size={28} color={colors.white} />
                  {importBadgeCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{importBadgeCount > 9 ? "9+" : importBadgeCount}</Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View style={styles.iconWrap}>
                  {isSelected && (
                    <LinearGradient
                      colors={[colors.gray900, colors.gray800]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.iconActiveBg}
                    />
                  )}
                  <Ionicons
                    name={tab.icon}
                    size={24}
                    color={isSelected ? colors.white : colors.gray500}
                  />
                  {tab.id === "import" && importBadgeCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{importBadgeCount > 9 ? "9+" : importBadgeCount}</Text>
                    </View>
                  )}
                </View>
              )}
              {!isPurple && !isSelected && <Text style={styles.label}>{tab.label}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    paddingBottom: 0,
    paddingTop: spacing.sm,
    position: "relative",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
  },
  inner: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 0,
    marginHorizontal: spacing.lg,
    marginBottom: 0,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  tab: {
    alignItems: "center",
    minWidth: 60,
    gap: 0,
  },
  purpleButton: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.purple600,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActiveBg: {
    position: "absolute",
    left: -6,
    right: -6,
    top: -6,
    bottom: -6,
    borderRadius: radius.md,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: colors.gray500,
    marginTop: 0,
  },
});
