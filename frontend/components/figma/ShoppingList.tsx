'use client';

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, ShoppingCart, Trash2, X, Pencil } from "lucide-react";
import type { ShoppingListItem } from "@/types/figma";

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

const createItemId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });

export function ShoppingList({ items, onUpdateItems, onBack }: ShoppingListProps) {
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

  const ingredientItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const nameA = a.name?.toLowerCase() ?? "";
      const nameB = b.name?.toLowerCase() ?? "";
      if (nameA && nameB) return nameA.localeCompare(nameB);
      if (nameA) return -1;
      if (nameB) return 1;
      return 0;
    });
  }, [items]);

  const handleToggleItem = (itemId: string) => {
    onUpdateItems(
      items.map((item) =>
        item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    onUpdateItems(items.filter((item) => item.id !== itemId));
  };

  const handleClearChecked = () => {
    onUpdateItems(items.filter((item) => !item.isChecked));
  };

  const handleAddOrEditItem = () => {
    if (!newItemName.trim()) {
      return;
    }
    const payload = {
      name: newItemName.trim(),
      amount: newItemAmount.trim() || undefined,
    };
    if (editingItemId) {
      onUpdateItems(
        items.map((item) =>
          item.id === editingItemId ? { ...item, ...payload } : item
        )
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

  const renderItemRow = (item: ShoppingListItem, showRecipeSource: boolean) => (
    <div
      key={item.id}
      className="flex items-start gap-3 border border-gray-100 rounded-xl px-4 py-3"
    >
      <input
        type="checkbox"
        checked={item.isChecked}
        onChange={() => handleToggleItem(item.id)}
        className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <p
            className={`text-sm ${
              item.isChecked ? "line-through text-gray-400" : "text-gray-900"
            }`}
          >
            {item.name}
          </p>
          {item.amount ? (
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                item.isChecked ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {item.amount}
            </span>
          ) : null}
        </div>
        {showRecipeSource && item.recipeName && (
          <p className="text-xs text-gray-500 mt-1">
            From {item.recipeName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            setEditingItemId(item.id);
            setNewItemName(item.name ?? "");
            setNewItemAmount(item.amount ?? "");
            setIsAddModalOpen(true);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          title="Edit item"
        >
          <Pencil className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => handleRemoveItem(item.id)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          title="Delete item"
        >
          <Trash2 className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-medium">Shopping List</h1>
        <button
          onClick={() => {
            setEditingItemId(null);
            setNewItemName("");
            setNewItemAmount("");
            setIsAddModalOpen(true);
          }}
          className="px-3 py-1.5 bg-black text-white rounded-full text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          {checkedCount > 0 && (
            <button
              onClick={handleClearChecked}
              className="text-gray-500 hover:text-black flex items-center gap-1 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear checked ({checkedCount})
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">View:</span>
            <div className="flex rounded-full bg-gray-100 p-1 text-sm">
              <button
                onClick={() => setViewMode("ingredient")}
                className={`px-3 py-1 rounded-full ${
                  viewMode === "ingredient" ? "bg-white shadow text-gray-900" : "text-gray-500"
                }`}
              >
                All ingredients
              </button>
              <button
                onClick={() => setViewMode("recipe")}
                className={`px-3 py-1 rounded-full ${
                  viewMode === "recipe" ? "bg-white shadow text-gray-900" : "text-gray-500"
                }`}
              >
                By recipe
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Start building your shopping list by adding items manually or directly from a recipe.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm"
            >
              Add Your First Item
            </button>
          </div>
        ) : viewMode === "recipe" ? (
          <div className="space-y-5">
            {recipeGroups.map((group) => (
              <div key={group.title}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{group.title}</h3>
                    {group.subtitle ? (
                      <p className="text-xs text-gray-500">{group.subtitle}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-400">
                    {group.items.length} item{group.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => renderItemRow(item, false))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {ingredientItems.map((item) => renderItemRow(item, true))}
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center pb-10">
          <div
            className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ minHeight: "45vh" }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-medium">{editingItemId ? "Edit Item" : "Add Item"}</h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItemId(null);
                  setNewItemName("");
                  setNewItemAmount("");
                }}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-600 mb-2 block">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g., Tomatoes"
                  className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-2 block">Amount (optional)</label>
                <input
                  type="text"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  placeholder="e.g., 500g or 2 pcs"
                  className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>
              <button
                onClick={handleAddOrEditItem}
                disabled={!newItemName.trim()}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-medium ${
                  newItemName.trim()
                    ? "bg-black text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {editingItemId ? "Save Changes" : "Add to List"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
