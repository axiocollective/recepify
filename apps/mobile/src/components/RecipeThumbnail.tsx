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
    { background: "#f1f5f9", icon: "#cbd5f5" },
    { background: "#eff6ff", icon: "#93c5fd" },
    { background: "#ecfdf5", icon: "#6ee7b7" },
    { background: "#fffbeb", icon: "#fcd34d" },
    { background: "#fff1f2", icon: "#fda4af" },
    { background: "#faf5ff", icon: "#c4b5fd" },
    { background: "#ecfeff", icon: "#67e8f9" },
    { background: "#fff7ed", icon: "#fdba74" },
  ];
  const hash = title.charCodeAt(0) + title.charCodeAt(title.length - 1);
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
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
});
