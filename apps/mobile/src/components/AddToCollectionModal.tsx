import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Recipe, RecipeCollection } from "../data/types";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe;
  collections: RecipeCollection[];
  onAddToCollection: (recipeId: string, collectionId: string) => void;
  onCreateCollection: (name: string, recipeId?: string) => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  isOpen,
  onClose,
  recipe,
  collections,
  onAddToCollection,
  onCreateCollection,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  if (!isOpen) {
    return null;
  }

  const handleCreate = () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed, recipe.id);
    setNewCollectionName("");
    setIsCreateOpen(false);
  };

  return (
    <Modal transparent animationType="fade" visible={isOpen}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow.lg]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add to Collection</Text>
              <View style={styles.recipeMeta}>
                <Text style={styles.recipeLabel}>Recipe</Text>
                <Text style={styles.recipeName}>{recipe.title}</Text>
              </View>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.gray500} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            <Pressable
              style={styles.createToggle}
              onPress={() => setIsCreateOpen((prev) => !prev)}
            >
              <View style={styles.createIcon}>
                <Ionicons name="folder-open-outline" size={20} color={colors.purple600} />
              </View>
              <Text style={styles.createToggleText}>
                {isCreateOpen ? "Cancel new collection" : "Create New Collection"}
              </Text>
            </Pressable>

            {isCreateOpen && (
              <View style={styles.createCard}>
                <Text style={styles.createLabel}>New Collection</Text>
                <TextInput
                  value={newCollectionName}
                  onChangeText={setNewCollectionName}
                  placeholder="e.g. Italian Dishes, Quick Meals..."
                  placeholderTextColor={colors.gray400}
                  style={styles.createInput}
                />
                <View style={styles.createActions}>
                  <Pressable
                    onPress={() => {
                      setIsCreateOpen(false);
                      setNewCollectionName("");
                    }}
                    style={styles.createCancel}
                  >
                    <Text style={styles.createCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreate}
                    disabled={!newCollectionName.trim()}
                    style={styles.createPrimary}
                  >
                    <LinearGradient
                      colors={[colors.purple500, colors.purple600]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.createPrimaryGradient}
                    >
                      <Text style={styles.createPrimaryText}>Create & Add</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>Your Collections</Text>
            <View style={styles.collectionList}>
              {collections.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No collections yet. Create your first one above.</Text>
                </View>
              ) : (
                collections.map((collection) => {
                  const isInCollection = collection.recipeIds.includes(recipe.id);
                  return (
                    <Pressable
                      key={collection.id}
                      onPress={() => onAddToCollection(recipe.id, collection.id)}
                      style={styles.collectionRow}
                    >
                      <View style={[styles.collectionCheck, isInCollection && styles.collectionCheckActive]}>
                        {isInCollection && (
                          <Ionicons name="checkmark" size={14} color={colors.purple600} />
                        )}
                      </View>
                      <View style={styles.collectionInfo}>
                        <Text style={styles.collectionName}>{collection.name}</Text>
                        <Text style={styles.collectionMeta}>
                          {collection.recipeIds.length} {collection.recipeIds.length === 1 ? "recipe" : "recipes"}
                        </Text>
                      </View>
                      <Text style={styles.collectionAction}>
                        {isInCollection ? "Added" : "Add"}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    overflow: "hidden",
    maxHeight: "90%",
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600",
    color: colors.gray900,
  },
  recipeMeta: {
    marginTop: spacing.sm,
  },
  recipeLabel: {
    ...typography.caption,
    color: colors.gray500,
  },
  recipeName: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  createToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 56,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.purple100,
    alignItems: "center",
    justifyContent: "center",
  },
  createToggleText: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  createCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.purple100,
    backgroundColor: "rgba(167,85,247,0.08)",
    gap: spacing.sm,
  },
  createLabel: {
    ...typography.caption,
    color: colors.gray600,
  },
  createInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    ...typography.bodySmall,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  createActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  createCancel: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  createCancelText: {
    ...typography.bodySmall,
    color: colors.gray900,
  },
  createPrimary: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    minHeight: 44,
  },
  createPrimaryGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createPrimaryText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  collectionList: {
    gap: spacing.sm,
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 56,
  },
  collectionCheck: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  collectionCheckActive: {
    borderColor: colors.purple600,
    backgroundColor: colors.purple100,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
  },
  collectionMeta: {
    ...typography.caption,
    color: colors.gray500,
  },
  collectionAction: {
    ...typography.caption,
    color: colors.purple600,
    fontWeight: "600",
  },
  emptyState: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  emptyText: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: "center",
  },
  doneButton: {
    margin: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "600",
  },
});
