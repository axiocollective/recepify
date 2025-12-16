'use client';

import { ArrowLeft, Link2, Camera, Plus, Inbox } from "lucide-react";
import type { Screen } from "@/types/figma";

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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 z-10">
        <button
          onClick={() => onNavigate("home")}
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Add Recipe</h1>
          <p className="text-sm text-gray-500">Choose how you want to add a recipe.</p>
        </div>
      </div>

      {/* Import Methods */}
      <div className="px-6 py-8 space-y-4">
        {importMethods.map((method) => {
          const Icon = method.icon;
          const isDisabled = Boolean(method.disabled);
          return (
            <button
              key={method.id}
              onClick={method.action}
              disabled={isDisabled}
              className={`w-full bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4 hover:border-gray-300 hover:shadow-sm transition-all text-left ${
                isDisabled ? "opacity-60 cursor-not-allowed hover:shadow-none" : ""
              }`}
            >

              <div className={`${method.color} w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative`}>
                <Icon className="w-5 h-5 text-white" />
                {method.badge && method.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                    {method.badge}
                  </span>
                )}
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-medium text-gray-900 mb-1">{method.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{method.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="px-6 pb-16">
        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">How it works</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
              <p className="pt-0.5"><strong>Import:</strong> Choose any method above to add a recipe.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
              <p className="pt-0.5"><strong>AI Processing:</strong> Our AI extracts ingredients and steps.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
              <p className="pt-0.5"><strong>Review & Save:</strong> Edit if needed, then save to your collection.</p>
            </div>
          </div>
        </div>
        <div className="h-2" />
      </div>
    </div>
  );
}
