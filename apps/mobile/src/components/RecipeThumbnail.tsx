import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius } from "../theme/theme";

interface RecipeThumbnailProps {
  imageUrl?: string;
  title: string;
  style?: object;
}

export const RecipeThumbnail: React.FC<RecipeThumbnailProps> = ({ imageUrl, title, style }) => {
  const palette = [
    { background: "#fff7e6", icon: "#f59e0b" },
    { background: "#e6fbff", icon: "#38bdf8" },
    { background: "#fff1e6", icon: "#fb923c" },
    { background: "#f6efff", icon: "#a855f7" },
  ];
  const safeTitle = title?.trim() || "recipe";
  const hash = Array.from(safeTitle).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const { background, icon } = palette[hash % palette.length];

  if (!imageUrl) {
    return (
      <View style={[styles.fallback, { backgroundColor: background }, style]}>
        <Ionicons name="restaurant-outline" size={20} color={icon} />
      </View>
    );
  }

  return <Image source={{ uri: imageUrl }} style={[styles.image, style]} resizeMode="cover" />;
};

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
    borderRadius: radius.lg,
  },
  fallback: {
    width: "100%",
    height: "100%",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
});
