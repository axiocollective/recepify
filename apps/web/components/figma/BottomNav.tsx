'use client';

import { Home, Download, BookOpen, ShoppingCart, User } from "lucide-react";

interface BottomNavProps {
  selected: "home" | "import" | "myRecipes" | "shoppingList" | "profile";
  onSelect: (tab: "home" | "import" | "myRecipes" | "shoppingList" | "profile") => void;
  importBadgeCount?: number;
}

export function BottomNav({ selected, onSelect, importBadgeCount = 0 }: BottomNavProps) {
  const tabs = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "import" as const, icon: Download, label: "Import", badge: importBadgeCount },
    { id: "myRecipes" as const, icon: BookOpen, label: "Recipes" },
    { id: "shoppingList" as const, icon: ShoppingCart, label: "List" },
    { id: "profile" as const, icon: User, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200/50 safe-area-bottom">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around px-4 pt-2 pb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selected === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onSelect(tab.id)}
                className="flex flex-col items-center justify-center gap-1 min-w-[60px] relative group"
              >
                <div className="relative">
                  {isSelected && (
                    <div className="absolute inset-0 -m-2 bg-gray-900 rounded-xl scale-110" />
                  )}
                  <Icon
                    className={`w-6 h-6 transition-colors relative z-10 ${
                      isSelected ? "text-white" : "text-gray-400 group-active:text-gray-600"
                    }`}
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[11px] leading-none min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-semibold px-1 z-20 shadow-sm">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </div>
                {!isSelected && (
                  <span className="text-[11px] leading-[14px] font-medium text-gray-400 group-active:text-gray-600">
                    {tab.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
