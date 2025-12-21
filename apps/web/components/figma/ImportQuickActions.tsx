'use client';

import { Camera, Inbox, Link2, Plus } from "lucide-react";
import type { Screen } from "@recepify/shared/types/figma";

interface ImportQuickActionsProps {
  onNavigate: (screen: Screen) => void;
  onAddManually: () => void;
  inboxCount?: number;
}

interface QuickAction {
  id: Screen | "manual" | "inbox";
  label: string;
  icon: React.ElementType;
}

const ACTIONS: QuickAction[] = [
  { id: "importFromLink", label: "Link", icon: Link2 },
  { id: "scanRecipe", label: "Scan", icon: Camera },
  { id: "manual", label: "Manual", icon: Plus },
  { id: "inbox", label: "Inbox", icon: Inbox },
];

export function ImportQuickActions({
  onNavigate,
  onAddManually,
  inboxCount = 0,
}: ImportQuickActionsProps) {
  const handleAction = (actionId: QuickAction["id"]) => {
    if (actionId === "manual") {
      onAddManually();
      return;
    }
    if (actionId === "inbox") {
      onNavigate("importInbox");
      return;
    }
    onNavigate(actionId);
  };

  return (
    <div className="px-5">
      <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-5 text-[15px] leading-[20px] font-medium text-gray-900">Add Recipe</p>
        <div className="flex items-center justify-between gap-3">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="flex flex-col items-center gap-2.5 text-[13px] leading-[18px] text-gray-600 active:opacity-70 transition-opacity"
            >
              <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gray-900 shadow-sm">
                <action.icon className="h-5 w-5 text-white" strokeWidth={2} />
                {action.id === "inbox" && inboxCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] leading-[14px] font-semibold text-white">
                    {inboxCount}
                  </span>
                )}
              </div>
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
