import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ImportItem, Platform } from "../data/types";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";
import { RecipeThumbnail } from "./RecipeThumbnail";

interface ImportInboxProps {
  items: ImportItem[];
  onBack: () => void;
  onAction: (itemId: string, action: "open" | "connect" | "retry" | "delete") => void;
}

export const ImportInbox: React.FC<ImportInboxProps> = ({ items, onBack, onAction }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Shared Recipes</Text>
          <Text style={styles.headerSubtitle}>Your import inbox</Text>
        </View>
      </View>

      <View style={styles.list}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="link-outline" size={36} color={colors.gray400} />
            </View>
            <Text style={styles.emptyTitle}>No shared recipes yet</Text>
            <Text style={styles.emptySubtitle}>
              Your inbox is empty. Share a recipe link from social media or the web, and it will appear here.
            </Text>
            <Pressable onPress={onBack} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Start importing</Text>
            </Pressable>
          </View>
        ) : (
          items.map((item) => (
            <ImportItemCard
              key={item.id}
              item={item}
              onAction={(action) => onAction(item.id, action)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
};

interface ImportItemCardProps {
  item: ImportItem;
  onAction: (action: "open" | "connect" | "retry" | "delete") => void;
}

const getPlatformLabel = (platform: Platform) => {
  switch (platform) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "pinterest":
      return "Pinterest";
    case "youtube":
      return "YouTube";
    case "web":
      return "Web";
    case "photo":
      return "Scan";
    default:
      return "Source";
  }
};

const getSourceLabel = (item: ImportItem) => {
  if (item.platform === "web" && item.url) {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch (error) {
      return "Web";
    }
  }
  return getPlatformLabel(item.platform);
};

const ImportItemCard: React.FC<ImportItemCardProps> = ({ item, onAction }) => {
  const isProcessing = item.status === "processing";
  const isFailed = item.status === "failed";

  const handlePrimary = () => {
    if (item.status === "needsConnection") {
      onAction("connect");
      return;
    }
    if (item.status === "failed") {
      onAction("retry");
      return;
    }
    onAction("open");
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.thumbWrap}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <RecipeThumbnail title={item.title} imageUrl={undefined} style={styles.thumbImage} />
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.sourceLabel}>{getSourceLabel(item)}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        <View style={styles.actionColumn}>
          <Pressable
            onPress={handlePrimary}
            disabled={isProcessing}
            style={[styles.actionButton, isProcessing ? styles.actionButtonDisabled : null]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>Import</Text>
            )}
          </Pressable>
          <Pressable onPress={() => onAction("delete")} style={styles.removeButton}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.gray500,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    ...shadow.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.gray100,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  cardContent: {
    flex: 1,
    gap: spacing.xs,
  },
  sourceLabel: {
    ...typography.caption,
    color: colors.gray500,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  actionColumn: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  actionButtonText: {
    ...typography.captionBold,
    color: colors.white,
  },
  removeButton: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    ...typography.caption,
    color: colors.gray700,
  },
});
