'use client';

import { ArrowLeft, Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useImportProgress } from "@recepify/shared/lib/use-import-progress";

interface ImportFromTikTokProps {
  onBack: () => void;
  onImport: (url: string) => Promise<void>;
}

const tiktokInitialStage = {
  progress: 15,
  message: "ChefGPT is fetching the TikTok..."
};

const tiktokProgressStages = [
  { delay: 900, progress: 38, message: "ChefGPT is transcribing the audio..." },
  { delay: 1800, progress: 65, message: "ChefGPT is pulling ingredients from the video..." },
  { delay: 2600, progress: 85, message: "ChefGPT is formatting the steps nicely..." },
];

export function ImportFromTikTok({ onBack, onImport }: ImportFromTikTokProps) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress, message } = useImportProgress(
    isImporting,
    tiktokProgressStages,
    tiktokInitialStage
  );

  const handleImport = async () => {
    if (!url.trim()) return;
    setIsImporting(true);
    setError(null);
    try {
      await onImport(url.trim());
      setUrl("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to import recipe");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyInstructions = () => {
    navigator.clipboard.writeText("Open TikTok → Find recipe video → Tap Share → Copy Link → Return to Recipefy → Paste link");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Import from TikTok</h1>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl mb-2">Share from TikTok</h2>
          <p className="text-sm text-gray-600">
            Import recipes directly from TikTok videos
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="text-sm text-gray-600">How to import:</h3>
          <div className="space-y-3">
            {[
              { step: 1, text: "Open TikTok app" },
              { step: 2, text: "Find the recipe video you want to save" },
              { step: 3, text: "Tap the Share button" },
              { step: 4, text: "Select 'Copy Link'" },
              { step: 5, text: "Return here and paste the link below" }
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                  {step}
                </div>
                <p className="flex-1 pt-0.5 text-sm text-gray-700">{text}</p>
              </div>
            ))}
          </div>
          
          <button
            onClick={handleCopyInstructions}
            className="w-full px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy instructions
              </>
            )}
          </button>
        </div>

        {/* URL Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-2">TikTok Video Link</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@username/video/..."
              className="w-full px-4 py-3.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
              disabled={isImporting}
            />
          </div>

          <button
            onClick={handleImport}
            disabled={!url.trim() || isImporting}
            className="w-full py-3.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importing…</span>
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
              <p className="text-xs text-gray-500">We’ll take you to the recipe when it’s ready.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Tip:</strong> You can also use the system share sheet! Just tap &quot;Share to Recipefy&quot; directly from TikTok.
          </p>
        </div>
      </div>
    </div>
  );
}
