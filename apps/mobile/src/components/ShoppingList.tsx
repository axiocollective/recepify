import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { ShoppingListItem } from "../data/types";
import { colors, radius, shadow, spacing, typography } from "../theme/theme";

interface ShoppingListProps {
  items: ShoppingListItem[];
  onUpdateItems: (items: ShoppingListItem[]) => void;
  onBack: () => void;
}

interface ShoppingListGroup {
  title: string;
  items: ShoppingListItem[];
  subtitle?: string;
}

interface IngredientGroupItem {
  id: string;
  name: string;
  amount?: string;
  isChecked: boolean;
  sourceIds: string[];
}

const createItemId = () => `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const ShoppingList: React.FC<ShoppingListProps> = ({ items, onUpdateItems, onBack }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [viewMode, setViewMode] = useState<"recipe" | "ingredient">("ingredient");

  const checkedCount = useMemo(() => items.filter((item) => item.isChecked).length, [items]);

  const recipeGroups = useMemo<ShoppingListGroup[]>(() => {
    const map = new Map<string, ShoppingListItem[]>();
    items.forEach((item) => {
      const key = item.recipeName?.trim() || "Added manually";
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    });
    return Array.from(map.entries()).map(([title, groupItems]) => ({
      title,
      subtitle: title === "Added manually" ? "Items you dropped in yourself" : undefined,
      items: groupItems,
    }));
  }, [items]);

  const ingredientItems = useMemo<IngredientGroupItem[]>(() => {
    const parseQuantity = (value: string): number | null => {
      const normalized = value.trim();
      if (!normalized) return null;
      if (normalized.includes("-")) return null;
      const fractionMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
      if (fractionMatch) {
        const whole = Number(fractionMatch[1]);
        const numerator = Number(fractionMatch[2]);
        const denominator = Number(fractionMatch[3]);
        if (denominator) {
          return whole + numerator / denominator;
        }
      }
      const simpleFraction = normalized.match(/^(\d+)\/(\d+)$/);
      if (simpleFraction) {
        const numerator = Number(simpleFraction[1]);
        const denominator = Number(simpleFraction[2]);
        if (denominator) {
          return numerator / denominator;
        }
      }
      const numeric = Number(normalized.replace(",", "."));
      return Number.isFinite(numeric) ? numeric : null;
    };

    const parseAmount = (amount?: string) => {
      if (!amount) return null;
      const match = amount.trim().match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?$/i);
      if (!match) return null;
      const quantity = parseQuantity(match[1]);
      if (quantity === null) return null;
      const unit = (match[2] || "").trim();
      return { quantity, unit };
    };

    const formatQuantity = (value: number) => {
      const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    };

    const grouped = new Map<string, IngredientGroupItem & { total?: number; unit?: string; mismatch?: boolean; fallbackAmount?: string }>();

    items.forEach((item) => {
      const name = item.name?.trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = grouped.get(key);
      const parsed = parseAmount(item.amount);
      if (!existing) {
        grouped.set(key, {
          id: `group-${key}`,
          name,
          amount: item.amount,
          isChecked: item.isChecked,
          sourceIds: [item.id],
          total: parsed?.quantity,
          unit: parsed?.unit,
          mismatch: false,
          fallbackAmount: !parsed ? item.amount : undefined,
        });
        return;
      }
      existing.sourceIds.push(item.id);
      existing.isChecked = existing.isChecked && item.isChecked;
      if (parsed) {
        if (!existing.unit) {
          existing.unit = parsed.unit;
          existing.total = (existing.total || 0) + parsed.quantity;
        } else if (existing.unit.toLowerCase() !== parsed.unit.toLowerCase()) {
          existing.mismatch = true;
        } else {
          existing.total = (existing.total || 0) + parsed.quantity;
        }
      } else if (!existing.fallbackAmount && item.amount) {
        existing.fallbackAmount = item.amount;
      }
    });

    return Array.from(grouped.values())
      .map((entry) => {
        if (!entry.mismatch && entry.total && entry.unit) {
          return {
            ...entry,
            amount: `${formatQuantity(entry.total)} ${entry.unit}`,
          };
        }
        return {
          ...entry,
          amount: entry.fallbackAmount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const handleToggleItem = (itemIds: string[]) => {
    const idSet = new Set(itemIds);
    const shouldCheck = items.filter((item) => idSet.has(item.id)).some((item) => !item.isChecked);
    onUpdateItems(
      items.map((item) => (idSet.has(item.id) ? { ...item, isChecked: shouldCheck } : item))
    );
  };

  const handleRemoveItem = (itemIds: string[]) => {
    const idSet = new Set(itemIds);
    onUpdateItems(items.filter((item) => !idSet.has(item.id)));
  };

  const handleClearChecked = () => {
    onUpdateItems(items.filter((item) => !item.isChecked));
  };

  const handleAddOrEditItem = () => {
    if (!newItemName.trim()) return;
    const payload = {
      name: newItemName.trim(),
      amount: newItemAmount.trim() || undefined,
    };
    if (editingItemId) {
      onUpdateItems(
        items.map((item) => (item.id === editingItemId ? { ...item, ...payload } : item))
      );
    } else {
      const newItem: ShoppingListItem = {
        id: createItemId(),
        name: payload.name,
        amount: payload.amount,
        isChecked: false,
      };
      onUpdateItems([...items, newItem]);
    }
    setNewItemName("");
    setNewItemAmount("");
    setEditingItemId(null);
    setIsAddModalOpen(false);
  };

  const renderSwipeDelete = (onDelete: () => void) => (
    <Pressable onPress={onDelete} style={styles.swipeDelete}>
      <Ionicons name="trash-outline" size={18} color={colors.white} />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </Pressable>
  );

  const renderItemRow = (
    item: ShoppingListItem | IngredientGroupItem,
    showRecipeSource: boolean
  ) => (
    <Swipeable
      renderRightActions={() =>
        renderSwipeDelete(() =>
          "sourceIds" in item ? handleRemoveItem(item.sourceIds) : handleRemoveItem([item.id])
        )
      }
      overshootRight={false}
    >
      <View key={item.id} style={styles.itemRow}>
        <Pressable
          onPress={() =>
            "sourceIds" in item ? handleToggleItem(item.sourceIds) : handleToggleItem([item.id])
          }
          style={[styles.checkbox, item.isChecked ? styles.checkboxChecked : null]}
        >
          {item.isChecked && <Ionicons name="checkmark" size={16} color={colors.white} />}
        </Pressable>
        <View style={styles.itemContent}>
          <View style={styles.itemHeaderRow}>
            <Text style={[styles.itemName, item.isChecked ? styles.itemNameChecked : null]}>
              {item.name}
            </Text>
            {item.amount ? (
              <Text style={[styles.itemAmount, item.isChecked ? styles.itemAmountChecked : null]}>
                {item.amount}
              </Text>
            ) : null}
          </View>
          {showRecipeSource && "recipeName" in item && item.recipeName ? (
            <Text style={styles.itemSource}>From {item.recipeName}</Text>
          ) : null}
        </View>
        <View style={styles.itemActions}>
          <Pressable
            onPress={() => {
              const targetId = "sourceIds" in item ? item.sourceIds[0] : item.id;
              setEditingItemId(targetId);
              setNewItemName(item.name ?? "");
              setNewItemAmount(item.amount ?? "");
              setIsAddModalOpen(true);
            }}
            style={styles.actionButton}
          >
            <Ionicons name="pencil" size={18} color={colors.gray400} />
          </Pressable>
          <Pressable
            onPress={() =>
              "sourceIds" in item ? handleRemoveItem(item.sourceIds) : handleRemoveItem([item.id])
            }
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={18} color={colors.gray400} />
          </Pressable>
        </View>
      </View>
    </Swipeable>
  );

  const renderIngredientRow = (item: IngredientGroupItem) => (
    <Swipeable
      renderRightActions={() => renderSwipeDelete(() => handleRemoveItem(item.sourceIds))}
      overshootRight={false}
    >
      <View key={item.id} style={styles.simpleRow}>
        <Pressable
          onPress={() => handleToggleItem(item.sourceIds)}
          style={[styles.checkbox, item.isChecked ? styles.checkboxChecked : null]}
        >
          {item.isChecked && <Ionicons name="checkmark" size={16} color={colors.white} />}
        </Pressable>
        <View style={styles.simpleContent}>
          <Text style={[styles.simpleName, item.isChecked ? styles.itemNameChecked : null]}>
            {item.name}
          </Text>
          {item.amount ? (
            <View style={styles.simpleAmountChip}>
              <Text style={styles.simpleAmountText}>{item.amount}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.simpleActions}>
          <Pressable
            onPress={() => {
              const targetId = item.sourceIds[0];
              const original = items.find((listItem) => listItem.id === targetId);
              setEditingItemId(targetId);
              setNewItemName(original?.name ?? item.name);
              setNewItemAmount(original?.amount ?? item.amount ?? "");
              setIsAddModalOpen(true);
            }}
            style={styles.actionButton}
          >
            <Ionicons name="pencil" size={18} color={colors.gray400} />
          </Pressable>
          <Pressable
            onPress={() => handleRemoveItem(item.sourceIds)}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={18} color={colors.gray400} />
          </Pressable>
        </View>
      </View>
    </Swipeable>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <Pressable
          onPress={() => {
            setEditingItemId(null);
            setNewItemName("");
            setNewItemAmount("");
            setIsAddModalOpen(true);
          }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={16} color={colors.white} />
          <Text style={styles.addButtonText}>Add Item</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {items.length} item{items.length === 1 ? "" : "s"}
            </Text>
            {checkedCount > 0 && (
              <Pressable onPress={handleClearChecked} style={styles.clearButton}>
                <Ionicons name="trash-outline" size={14} color={colors.gray600} />
                <Text style={styles.clearText}>Clear checked ({checkedCount})</Text>
              </Pressable>
            )}
          </View>

          {items.length > 0 && (
            <View style={styles.viewToggleRow}>
              <Text style={styles.viewLabel}>View</Text>
              <View style={styles.toggleGroup}>
                <Pressable
                  onPress={() => setViewMode("ingredient")}
                  style={[styles.toggleItem, viewMode === "ingredient" ? styles.toggleActive : null]}
                >
                  <Text style={[styles.toggleText, viewMode === "ingredient" ? styles.toggleTextActive : null]}>
                    All ingredients
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setViewMode("recipe")}
                  style={[styles.toggleItem, viewMode === "recipe" ? styles.toggleActive : null]}
                >
                  <Text style={[styles.toggleText, viewMode === "recipe" ? styles.toggleTextActive : null]}>
                    By recipe
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cart-outline" size={36} color={colors.gray400} />
            </View>
            <Text style={styles.emptyTitle}>Your list is empty</Text>
            <Text style={styles.emptySubtitle}>
              Start building your shopping list by adding items manually or directly from a recipe.
            </Text>
            <Pressable onPress={() => setIsAddModalOpen(true)} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Add Your First Item</Text>
            </Pressable>
          </View>
        ) : viewMode === "recipe" ? (
          <View style={styles.groupList}>
            {recipeGroups.map((group) => (
              <View key={group.title} style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <View>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    {group.subtitle ? <Text style={styles.groupSubtitle}>{group.subtitle}</Text> : null}
                  </View>
                  <Text style={styles.groupCount}>
                    {group.items.length} item{group.items.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={styles.groupItems}>
                  {group.items.map((item) => (
                    <View key={item.id} style={styles.simpleRow}>
                      <Pressable
                        onPress={() => handleToggleItem([item.id])}
                        style={[styles.checkbox, item.isChecked ? styles.checkboxChecked : null]}
                      >
                        {item.isChecked && <Ionicons name="checkmark" size={16} color={colors.white} />}
                      </Pressable>
                      <View style={styles.simpleContent}>
                        <Text style={[styles.simpleName, item.isChecked ? styles.itemNameChecked : null]}>
                          {item.name}
                        </Text>
                        {item.amount ? (
                          <View style={styles.simpleAmountChip}>
                            <Text style={styles.simpleAmountText}>{item.amount}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.simpleActions}>
                        <Pressable
                          onPress={() => {
                            setEditingItemId(item.id);
                            setNewItemName(item.name ?? "");
                            setNewItemAmount(item.amount ?? "");
                            setIsAddModalOpen(true);
                          }}
                          style={styles.actionButton}
                        >
                          <Ionicons name="pencil" size={18} color={colors.gray400} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleRemoveItem([item.id])}
                          style={styles.actionButton}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.gray400} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.groupItems}>
            {ingredientItems.map((item) => renderIngredientRow(item))}
          </View>
        )}
      </View>

      <Modal transparent animationType="slide" visible={isAddModalOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItemId ? "Edit Item" : "Add Item"}</Text>
              <Pressable
                onPress={() => {
                  setIsAddModalOpen(false);
                  setEditingItemId(null);
                  setNewItemName("");
                  setNewItemAmount("");
                }}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={18} color={colors.gray900} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Item Name</Text>
                <TextInput
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="e.g., Tomatoes"
                  placeholderTextColor={colors.gray400}
                  style={styles.modalInput}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Amount (optional)</Text>
                <TextInput
                  value={newItemAmount}
                  onChangeText={setNewItemAmount}
                  placeholder="e.g., 500g or 2 pcs"
                  placeholderTextColor={colors.gray400}
                  style={styles.modalInput}
                />
              </View>
              <Pressable
                onPress={handleAddOrEditItem}
                disabled={!newItemName.trim()}
                style={[styles.modalPrimary, !newItemName.trim() ? styles.modalPrimaryDisabled : null]}
              >
                <Text style={[styles.modalPrimaryText, !newItemName.trim() ? styles.modalPrimaryTextDisabled : null]}>
                  {editingItemId ? "Save Changes" : "Add to List"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    minHeight: 36,
  },
  addButtonText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryText: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  clearText: {
    ...typography.caption,
    color: colors.gray700,
  },
  viewToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  viewLabel: {
    ...typography.caption,
    color: colors.gray600,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  toggleGroup: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 4,
  },
  toggleItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  toggleActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  toggleText: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  toggleTextActive: {
    color: colors.gray900,
    fontWeight: "600",
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
  groupList: {
    gap: spacing.xl,
  },
  groupBlock: {
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTitle: {
    ...typography.bodyBold,
    color: colors.gray900,
  },
  groupSubtitle: {
    ...typography.caption,
    color: colors.gray500,
  },
  groupCount: {
    ...typography.caption,
    color: colors.gray400,
  },
  groupItems: {
    gap: spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
    ...shadow.md,
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
    ...shadow.md,
  },
  simpleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  simpleName: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
    flex: 1,
  },
  simpleAmountChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  simpleAmountText: {
    ...typography.caption,
    color: colors.gray800,
  },
  simpleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.gray900,
    borderColor: colors.gray900,
  },
  itemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  itemName: {
    ...typography.bodySmall,
    color: colors.gray900,
    fontWeight: "600",
    flex: 1,
  },
  itemNameChecked: {
    color: colors.gray400,
    textDecorationLine: "line-through",
  },
  itemAmount: {
    ...typography.caption,
    color: colors.gray600,
  },
  itemAmountChecked: {
    color: colors.gray400,
  },
  itemSource: {
    ...typography.caption,
    color: colors.gray500,
  },
  itemActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeDelete: {
    justifyContent: "center",
    alignItems: "center",
    width: 86,
    backgroundColor: colors.red500,
    borderRadius: radius.lg,
    marginVertical: spacing.xs,
    marginRight: spacing.sm,
    gap: 2,
  },
  swipeDeleteText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 32,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: colors.gray900,
  },
  modalClose: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  modalField: {
    gap: spacing.sm,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.gray600,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    ...typography.body,
  },
  modalPrimary: {
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryDisabled: {
    backgroundColor: colors.gray200,
  },
  modalPrimaryText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  modalPrimaryTextDisabled: {
    color: colors.gray400,
  },
});
