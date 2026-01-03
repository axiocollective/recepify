import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const detectDefaultUnit = () => {
    const text = items.map((item) => item.amount ?? "").join(" ").toLowerCase();
    return /(g|kg|ml|l|°c)\b/.test(text) ? "metric" : "us";
  };
  const [unitSystem, setUnitSystem] = useState<"metric" | "us">(detectDefaultUnit());

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

  const parseAmountParts = (amount: string) => {
    const match = amount.trim().match(
      /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?$/i
    );
    if (!match) return null;
    const quantity = parseQuantity(match[1]);
    if (quantity === null) return null;
    const unitRaw = (match[2] || "").trim().toLowerCase();
    return { quantity, unitRaw };
  };

  const normalizeUnit = (unitRaw: string): string | null => {
    const map: Record<string, string> = {
      g: "g",
      gram: "g",
      grams: "g",
      kg: "kg",
      kilogram: "kg",
      kilograms: "kg",
      ml: "ml",
      milliliter: "ml",
      millilitre: "ml",
      l: "l",
      liter: "l",
      litre: "l",
      oz: "oz",
      ounce: "oz",
      ounces: "oz",
      lb: "lb",
      lbs: "lb",
      pound: "lb",
      pounds: "lb",
      cup: "cup",
      cups: "cup",
      tbsp: "tbsp",
      tbs: "tbsp",
      tablespoon: "tbsp",
      tablespoons: "tbsp",
      tsp: "tsp",
      teaspoon: "tsp",
      teaspoons: "tsp",
      "fl oz": "fl oz",
      floz: "fl oz",
      "fluid ounce": "fl oz",
      "fluid ounces": "fl oz",
    };
    return map[unitRaw] || null;
  };

  const formatQuantity = (value: number) => {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  const convertAmount = (amount: string, nextUnitSystem: "metric" | "us") => {
    const parts = parseAmountParts(amount);
    if (!parts) return amount;
    const unit = normalizeUnit(parts.unitRaw || "");
    if (!unit) return amount;
    const value = parts.quantity;
    if (nextUnitSystem === "us") {
      if (["g", "kg", "ml", "l"].includes(unit)) {
        const grams = unit === "g" ? value : unit === "kg" ? value * 1000 : unit === "ml" ? value : value * 1000;
        return `${formatQuantity(grams / 28.3495)} oz`;
      }
      if (unit === "oz") return `${formatQuantity(value)} oz`;
      if (unit === "lb") return `${formatQuantity(value)} lb`;
      if (unit === "cup") return `${formatQuantity(value)} cup`;
      if (unit === "tbsp") return `${formatQuantity(value)} tbsp`;
      if (unit === "tsp") return `${formatQuantity(value)} tsp`;
      if (unit === "fl oz") return `${formatQuantity(value)} fl oz`;
    } else {
      if (["oz", "lb", "cup", "tbsp", "tsp", "fl oz"].includes(unit)) {
        if (unit === "oz") return `${formatQuantity(value * 28.3495)} g`;
        if (unit === "lb") return `${formatQuantity(value * 453.592)} g`;
        if (unit === "cup") return `${formatQuantity(value * 240)} ml`;
        if (unit === "tbsp") return `${formatQuantity(value * 15)} ml`;
        if (unit === "tsp") return `${formatQuantity(value * 5)} ml`;
        if (unit === "fl oz") return `${formatQuantity(value * 29.5735)} ml`;
      }
      if (unit === "g") return `${formatQuantity(value)} g`;
      if (unit === "kg") return `${formatQuantity(value)} kg`;
      if (unit === "ml") return `${formatQuantity(value)} ml`;
      if (unit === "l") return `${formatQuantity(value)} l`;
    }
    return amount;
  };

  const ingredientItems = useMemo<IngredientGroupItem[]>(() => {
    const parseAmount = (amount?: string) => {
      if (!amount) return null;
      const match = amount.trim().match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?$/i);
      if (!match) return null;
      const quantity = parseQuantity(match[1]);
      if (quantity === null) return null;
      const unit = (match[2] || "").trim();
      return { quantity, unit };
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

  const handleDeleteChecked = () => {
    onUpdateItems(items.filter((item) => !item.isChecked));
  };

  const openEditModal = (targetId: string, name?: string, amount?: string) => {
    setEditingItemId(targetId);
    setNewItemName(name ?? "");
    setNewItemAmount(amount ?? "");
    setIsAddModalOpen(true);
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

  const renderIngredientRow = (item: IngredientGroupItem) => (
    <View key={item.id} style={styles.simpleRow}>
      <Pressable
        onPress={() => handleToggleItem(item.sourceIds)}
        style={[styles.checkbox, item.isChecked ? styles.checkboxChecked : null]}
      >
        {item.isChecked && <Ionicons name="checkmark" size={16} color={colors.white} />}
      </Pressable>
      <Pressable
        onLongPress={() => {
          const targetId = item.sourceIds[0];
          const original = items.find((listItem) => listItem.id === targetId);
          openEditModal(targetId, original?.name ?? item.name, original?.amount ?? item.amount);
        }}
        style={styles.simpleContent}
      >
        <Text style={[styles.ingredientText, item.isChecked ? styles.ingredientTextChecked : null]}>
          {item.amount ? (
            <Text style={[styles.ingredientAmountText, item.isChecked ? styles.ingredientAmountTextChecked : null]}>
              {convertAmount(item.amount, unitSystem)}{" "}
            </Text>
          ) : null}
          <Text style={[styles.ingredientNameText, item.isChecked ? styles.ingredientNameTextChecked : null]}>
            {item.name}
          </Text>
        </Text>
      </Pressable>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleDeleteChecked}
            disabled={checkedCount === 0}
            style={[styles.deleteButton, checkedCount === 0 ? styles.deleteButtonDisabled : null]}
          >
            <Ionicons name="trash-outline" size={16} color={checkedCount === 0 ? colors.gray400 : colors.white} />
          </Pressable>
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
      </View>

      <View style={styles.body}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {items.length} item{items.length === 1 ? "" : "s"}
            </Text>
          </View>

          {items.length > 0 && (
            <View style={styles.viewToggleRow}>
              <View style={styles.viewGroup}>
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
              <View style={styles.unitToggleRow}>
                <Text style={styles.viewLabel}>Units</Text>
                <View style={styles.unitToggle}>
                  {(["metric", "us"] as const).map((unit) => (
                    <Pressable
                      key={unit}
                      style={[styles.unitChip, unitSystem === unit && styles.unitChipActive]}
                      onPress={() => setUnitSystem(unit)}
                    >
                      <Text style={[styles.unitChipText, unitSystem === unit && styles.unitChipTextActive]}>
                        {unit === "metric" ? "Metric" : "US"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                      <Pressable
                        onLongPress={() => openEditModal(item.id, item.name, item.amount)}
                        style={styles.simpleContent}
                      >
                        <Text style={[styles.ingredientText, item.isChecked ? styles.ingredientTextChecked : null]}>
                          {item.amount ? (
                            <Text style={[styles.ingredientAmountText, item.isChecked ? styles.ingredientAmountTextChecked : null]}>
                              {convertAmount(item.amount, unitSystem)}{" "}
                            </Text>
                          ) : null}
                          <Text style={[styles.ingredientNameText, item.isChecked ? styles.ingredientNameTextChecked : null]}>
                            {item.name}
                          </Text>
                        </Text>
                      </Pressable>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.red500,
  },
  deleteButtonDisabled: {
    backgroundColor: colors.red100,
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
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 4,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  unitChipActive: {
    backgroundColor: colors.white,
    ...shadow.md,
  },
  unitChipText: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  unitChipTextActive: {
    color: colors.gray900,
    fontWeight: "600",
  },
  viewToggleRow: {
    gap: spacing.sm,
  },
  viewGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  unitToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.gray900,
    borderColor: colors.gray900,
  },
  ingredientText: {
    ...typography.body,
    color: colors.gray900,
    flex: 1,
  },
  ingredientTextChecked: {
    color: colors.gray500,
    textDecorationLine: "line-through",
  },
  ingredientAmountText: {
    fontWeight: "700",
    color: colors.gray700,
  },
  ingredientAmountTextChecked: {
    color: colors.gray500,
  },
  ingredientNameText: {
    color: colors.gray900,
  },
  ingredientNameTextChecked: {
    color: colors.gray500,
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
