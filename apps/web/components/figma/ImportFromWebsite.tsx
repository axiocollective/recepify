'use client';

import { ArrowLeft, Link2, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { useImportProgress } from "@recepify/shared/lib/use-import-progress";

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
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1 -ml-1 active:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Import from Website</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Link2 className="w-7 h-7 text-gray-600" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl mb-2">Paste Recipe URL</h2>
          <p className="text-sm text-gray-600">
            Import recipes from any website or social media platform
          </p>
        </div>

        {/* URL Input */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/recipe"
              className="w-full px-4 py-3.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 pr-20 text-sm"
            />
            <button
              onClick={handlePaste}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
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
          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={!isValidUrl || isImporting}
            className="w-full py-3.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <span>Import Recipe</span>
            )}
          </button>
          {isImporting && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
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
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong className="text-gray-900">How it works:</strong> Paste any recipe URL and we&apos;ll automatically extract the ingredients, instructions, and cooking details.
          </p>
        </div>
        <div className="mt-6" />
      </div>
    </div>
  );
}
