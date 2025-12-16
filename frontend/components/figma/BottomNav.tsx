'use client';

import { Home, PlusCircle, BookOpen, User, ShoppingCart } from "lucide-react";

interface BottomNavProps {
  selected: "home" | "import" | "myRecipes" | "shoppingList" | "profile";
  onSelect: (tab: "home" | "import" | "myRecipes" | "shoppingList" | "profile") => void;
  importBadgeCount?: number;
}

export function BottomNav({ selected, onSelect, importBadgeCount = 0 }: BottomNavProps) {
  const tabs = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "import" as const, icon: PlusCircle, label: "Add Recipe", badge: importBadgeCount },
    { id: "myRecipes" as const, icon: BookOpen, label: "My Recipes" },
    { id: "shoppingList" as const, icon: ShoppingCart, label: "Shopping" },
    { id: "profile" as const, icon: User, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around px-2 py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selected === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onSelect(tab.id)}
                className="flex flex-col items-center justify-center py-1 px-3 relative"
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? "text-black" : "text-gray-400"
                    }`}
                  />
                  {typeof tab.badge === "number" && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-black text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isSelected ? "text-black" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
