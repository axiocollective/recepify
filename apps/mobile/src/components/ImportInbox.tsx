import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ImportItem, Platform } from "../data/types";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface ImportInboxProps {
  items: ImportItem[];
  onBack: () => void;
  onAction: (itemId: string, action: "open" | "connect" | "retry" | "delete") => void;
}

export const ImportInbox: React.FC<ImportInboxProps> = ({ items, onBack, onAction }) => {
  const readyCount = items.length;
  const subtitle = `${readyCount} recipe${readyCount === 1 ? "" : "s"} ready to import`;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Shared Recipes</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="link-outline" size={32} color={colors.gray400} />
            </View>
            <Text style={styles.emptyTitle}>No shared recipes yet</Text>
            <Text style={styles.emptySubtitle}>
              Share any TikTok, Instagram, Pinterest or web recipe to send it to your inbox.
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
    default:
      return "Source";
  }
};

const getPlatformIcon = (platform: Platform) => {
  switch (platform) {
    case "tiktok":
      return { name: "logo-tiktok" as const, color: colors.gray900 };
    case "instagram":
      return { name: "logo-instagram" as const, color: "#ec4899" };
    case "pinterest":
      return { name: "logo-pinterest" as const, color: "#ef4444" };
    case "web":
      return { name: "globe-outline" as const, color: colors.gray400 };
    default:
      return { name: "link-outline" as const, color: colors.gray400 };
  }
};

const ImportItemCard: React.FC<ImportItemCardProps> = ({ item, onAction }) => {
  const isProcessing = item.status === "processing";
  const isFailed = item.status === "failed";
  const isConnect = item.status === "needsConnection";
  const icon = getPlatformIcon(item.platform);
  const actionLabel = isConnect ? "Connect" : isFailed ? "Retry" : "Import";

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
      <View style={styles.titleBlock}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.platformRow}>
          <Ionicons name={icon.name} size={16} color={icon.color} />
          <Text style={styles.platformLabel}>{getPlatformLabel(item.platform)}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={handlePrimary}
          disabled={isProcessing}
          style={[styles.actionButton, isProcessing ? styles.actionButtonDisabled : null]}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.white} />
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={() => onAction("delete")} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={18} color={colors.gray400} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    paddingBottom: 96,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.white,
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
    paddingVertical: spacing.lg,
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
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.md,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
    fontSize: 17,
    lineHeight: 22,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  platformLabel: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  actionButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
