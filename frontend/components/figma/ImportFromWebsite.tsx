'use client';

import { ArrowLeft, Link2, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { useImportProgress } from "@/lib/use-import-progress";

type ImportSource = "tiktok" | "instagram" | "pinterest" | "web";

interface ImportFromWebsiteProps {
  onBack: () => void;
  onImport: (url: string, source: ImportSource) => Promise<void> | void;
}

const sourceNames: Record<ImportSource, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  pinterest: "Pinterest",
  web: "Website",
};

const detectSource = (value: string): ImportSource => {
  const lower = value.toLowerCase();
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok.com")) return "tiktok";
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) return "instagram";
  if (lower.includes("pinterest.com") || lower.includes("pin.it")) return "pinterest";
  return "web";
};

const webInitialStage = {
  progress: 12,
  message: "ChefGPT is checking your link..."
};

const webProgressStages = [
  { delay: 700, progress: 30, message: "ChefGPT is opening the website..." },
  { delay: 1500, progress: 55, message: "ChefGPT is parsing the ingredients..." },
  { delay: 2400, progress: 78, message: "ChefGPT is rewriting the steps clearly..." },
];

export function ImportFromWebsite({ onBack, onImport }: ImportFromWebsiteProps) {
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);
  const { progress, message } = useImportProgress(isImporting, webProgressStages, webInitialStage);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value.trim().length > 6) {
      const source = detectSource(value);
      setDetectedSource(sourceNames[source]);
    } else {
      setDetectedSource(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleUrlChange(text);
    } catch (error) {
      console.error("Failed to read clipboard", error);
    }
  };

  const handleImport = async () => {
    if (!url.trim()) return;
    try {
      setIsImporting(true);
      await onImport(url.trim(), detectSource(url));
    } finally {
      setIsImporting(false);
    }
  };

  const isValidUrl = url.trim().length > 0 && (url.includes("http") || url.includes("www"));

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Import from Platform</h1>
      </div>

      {/* Content */}
      <div className="px-6 py-8 space-y-8">
        {/* Icon & Description */}
        <div className="text-center mb-2">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-xl font-medium mb-2">Paste any recipe link</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            We&apos;ll automatically detect if it&apos;s from TikTok, Instagram, Pinterest, or any recipe website.
          </p>
        </div>

        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipe URL
          </label>
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3.5 pr-20 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            />
            <button
              onClick={handlePaste}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm text-gray-600 hover:text-black transition-colors"
            >
              Paste
            </button>
          </div>
          {detectedSource && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="w-4 h-4" />
              <span>
                Detected: <strong>{detectedSource}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={!isValidUrl || isImporting}
          className={`w-full py-3.5 rounded-xl font-medium transition-all ${
            isValidUrl && !isImporting
              ? "bg-black text-white hover:bg-gray-800"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isImporting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </span>
          ) : (
            "Import Recipe"
          )}
        </button>
        {isImporting && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{message || "ChefGPT is doing its magic..."}</span>
            </div>
            <div className="h-1.5 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-black transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(95, Math.max(progress || 10, 8))}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">Hang tight while we import that recipe.</p>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-3">How to get the link</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
              <div className="pt-0.5">
                <p className="font-medium text-gray-900">Find a recipe</p>
                <p className="text-gray-500 mt-0.5">On TikTok, Instagram, Pinterest, or any recipe blog.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
              <div className="pt-0.5">
                <p className="font-medium text-gray-900">Copy the link</p>
                <p className="text-gray-500 mt-0.5">Tap Share → Copy Link in the app or copy from the address bar.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
              <div className="pt-0.5">
                <p className="font-medium text-gray-900">Paste above</p>
                <p className="text-gray-500 mt-0.5">We&apos;ll extract the recipe and let you edit it before saving.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Supported Platforms */}
        <div>
          <p className="text-xs text-gray-400 text-center mb-3">Supported platforms</p>
          <div className="flex justify-center gap-4 flex-wrap">
            {[
              { name: "TikTok", icon: "🎵" },
              { name: "Instagram", icon: "📷" },
              { name: "Pinterest", icon: "📌" },
              { name: "Any Website", icon: "🌐" },
            ].map((platform) => (
              <div key={platform.name} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm">{platform.icon}</span>
                <span className="text-xs text-gray-600">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
