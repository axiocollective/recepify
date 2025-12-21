'use client';

import { ArrowLeft, Link2, Camera, Plus, Inbox } from "lucide-react";
import type { Screen } from "@recepify/shared/types/figma";

interface ImportHubProps {
  onNavigate: (screen: Screen) => void;
  onAddManually: () => void;
  sharedRecipesCount?: number;
}

type ImportMethod = {
  id: Screen | "addManually";
  icon: typeof Link2;
  title: string;
  description: string;
  color: string;
  action: () => void;
  badge?: number;
  disabled?: boolean;
};

export function ImportHub({
  onNavigate,
  onAddManually,
  sharedRecipesCount = 0,
}: ImportHubProps) {
  const importMethods: ImportMethod[] = [
    {
      id: "importFromLink" as const,
      icon: Link2,
      title: "From Link",
      description: "Paste a TikTok, Instagram, Pinterest or any recipe link.",
      color: "bg-black",
      action: () => onNavigate("importFromLink"),
    },
    {
      id: "scanRecipe" as const,
      icon: Camera,
      title: "Scan",
      description: "Take a photo of a recipe card or cookbook page.",
      color: "bg-black",
      action: () => onNavigate("scanRecipe"),
    },
    {
      id: "addManually" as const,
      icon: Plus,
      title: "Manual",
      description: "Start from scratch and type it out yourself.",
      color: "bg-black",
      action: onAddManually,
    },
    {
      id: "importInbox" as const,
      icon: Inbox,
      title: "Inbox",
      description: "View recipes shared via your import inbox.",
      color: "bg-black",
      badge: sharedRecipesCount,
      action: () => onNavigate("importInbox"),
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3 z-10">
        <button
          onClick={() => onNavigate("home")}
          className="w-11 h-11 rounded-full active:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[17px] leading-[22px] font-semibold">Add Recipe</h1>
          <p className="text-[13px] leading-[18px] text-gray-500">Choose how you want to add a recipe</p>
        </div>
      </div>

      {/* Import Methods */}
      <div className="px-5 py-8 space-y-4">
        {importMethods.map((method) => {
          const Icon = method.icon;
          const isDisabled = Boolean(method.disabled);
          return (
            <button
              key={method.id}
              onClick={method.action}
              disabled={isDisabled}
              className={`w-full bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4 active:bg-gray-50 transition-colors text-left min-h-[88px] ${
                isDisabled ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >

              <div className={`${method.color} w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 relative`}>
                <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                {method.badge && method.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[11px] leading-[14px] w-5 h-5 rounded-full flex items-center justify-center font-semibold">
                    {method.badge}
                  </span>
                )}
              </div>
              <div className="flex-1 pt-1.5">
                <h3 className="text-[17px] leading-[22px] font-semibold text-gray-900 mb-1">{method.title}</h3>
                <p className="text-[15px] leading-[20px] text-gray-500">{method.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="px-5 pb-16">
        <div className="bg-gray-50 rounded-2xl p-5 mb-6">
          <h3 className="text-[17px] leading-[22px] font-semibold text-gray-900 mb-4">How it works</h3>
          <div className="space-y-4 text-[15px] leading-[20px] text-gray-600">
            <div className="flex gap-3">
              <span className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[13px] leading-[18px] font-semibold">1</span>
              <p className="pt-0.5"><span className="font-semibold text-gray-900">Import:</span> Choose any method above to add a recipe.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[13px] leading-[18px] font-semibold">2</span>
              <p className="pt-0.5"><span className="font-semibold text-gray-900">AI Processing:</span> Our AI extracts ingredients and steps.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[13px] leading-[18px] font-semibold">3</span>
              <p className="pt-0.5"><span className="font-semibold text-gray-900">Review & Save:</span> Edit if needed, then save to your collection.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
