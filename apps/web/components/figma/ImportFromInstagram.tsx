'use client';

import { ArrowLeft, Copy, Check, Loader2, Instagram } from "lucide-react";
import { useState } from "react";
import { useImportProgress } from "@recepify/shared/lib/use-import-progress";

interface ImportFromInstagramProps {
  onBack: () => void;
  onImport: (url: string) => Promise<void>;
}

const instagramInitialStage = {
  progress: 14,
  message: "ChefGPT is checking that Instagram link..."
};

const instagramProgressStages = [
  { delay: 800, progress: 33, message: "ChefGPT is downloading the reel..." },
  { delay: 1600, progress: 58, message: "ChefGPT is transcribing the audio..." },
  { delay: 2400, progress: 82, message: "ChefGPT is organizing the recipe..." },
];

export function ImportFromInstagram({ onBack, onImport }: ImportFromInstagramProps) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress, message } = useImportProgress(
    isImporting,
    instagramProgressStages,
    instagramInitialStage
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
    navigator.clipboard.writeText(
      "Open Instagram → Find the recipe reel/post → Tap Share → Copy Link → Return to Recipefy → Paste link"
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Import from Instagram</h1>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white">
            <Instagram className="w-7 h-7" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl mb-2">Share from Instagram</h2>
          <p className="text-sm text-gray-600">
            Import recipes directly from Instagram reels or posts
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="text-sm text-gray-600">How to import:</h3>
          <div className="space-y-3">
            {[
              { step: 1, text: "Open Instagram app" },
              { step: 2, text: "Find the recipe reel or post" },
              { step: 3, text: "Tap the Share button" },
              { step: 4, text: "Select 'Copy Link'" },
              { step: 5, text: "Paste the link below" },
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

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-2">Instagram Reel or Post Link</label>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full px-4 py-3.5 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm"
              disabled={isImporting}
            />
          </div>

          <button
            onClick={handleImport}
            disabled={!url.trim() || isImporting}
            className="w-full py-3.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
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
              <p className="text-xs text-gray-500">ChefGPT will drop you into the recipe when it’s ready.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Tip:</strong> Works with reels and feed videos. Private profiles aren&apos;t supported yet.
          </p>
        </div>
      </div>
    </div>
  );
}
