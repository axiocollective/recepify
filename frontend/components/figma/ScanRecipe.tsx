'use client';

import NextImage from "next/image";
import { ArrowLeft, Camera, Image as ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { importFromScan, type ImportedRecipePayload } from "@/lib/api";
import { useImportProgress } from "@/lib/use-import-progress";

interface ScanRecipeProps {
  onBack: () => void;
  onScanComplete: (recipe: ImportedRecipePayload) => Promise<void> | void;
}

const scanInitialStage = {
  progress: 18,
  message: "ChefGPT is reading your photo..."
};

const scanProgressStages = [
  { delay: 800, progress: 42, message: "ChefGPT is enhancing the image..." },
  { delay: 1600, progress: 68, message: "ChefGPT is deciphering your handwriting..." },
  { delay: 2400, progress: 88, message: "ChefGPT is shaping the recipe..." },
];

export function ScanRecipe({ onBack, onScanComplete }: ScanRecipeProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { progress, message } = useImportProgress(isScanning, scanProgressStages, scanInitialStage);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const processImage = async (file: File) => {
    setIsScanning(true);
    setError(null);
    try {
      const response = await importFromScan(file);
      await onScanComplete(response.recipe);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to scan recipe. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewObjectUrl(objectUrl);
    setPreviewImage(objectUrl);
    await processImage(file);
  };

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
        <h1 className="text-xl font-semibold">Scan Recipe</h1>
      </div>

      {/* Content */}
      <div className="px-6 py-8 space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-xl font-medium mb-2">Scan a recipe</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Take a photo of a recipe card, cookbook page, or handwritten recipe. Our AI will extract the details.
          </p>
        </div>

        {previewImage ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <NextImage
              src={previewImage}
              alt="Recipe preview"
              width={1200}
              height={800}
              className="w-full h-auto object-cover"
              unoptimized
            />
            {isScanning && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center px-4">
                <div className="bg-white rounded-xl px-6 py-4 space-y-3 w-full max-w-sm">
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-900">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{message || "ChefGPT is doing its magic..."}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.min(98, Math.max(progress || 12, 10))}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">This can take a few seconds.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isScanning}
              />
              <div
                className={`border-2 border-dashed border-gray-200 rounded-xl p-12 text-center transition-colors ${
                  isScanning ? "opacity-60 cursor-not-allowed" : "hover:border-gray-300 cursor-pointer"
                }`}
              >
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-900 mb-1">Take a photo</p>
                <p className="text-sm text-gray-500">
                  {isScanning ? "Processing…" : "Tap to open camera"}
                </p>
              </div>
            </label>
          </div>
        )}

        {!previewImage && (
          <div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-400">OR</span>
              </div>
            </div>
            <label className="block mt-6">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isScanning}
              />
              <div
                className={`border border-gray-200 rounded-xl p-6 text-center transition-colors ${
                  isScanning ? "opacity-60 cursor-not-allowed" : "hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
                }`}
              >
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="font-medium text-gray-900 mb-1">Upload from gallery</p>
                <p className="text-sm text-gray-500">
                  {isScanning ? "Processing…" : "Choose an existing photo"}
                </p>
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-3">Tips for best results</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
              <div className="pt-0.5">
                <p className="font-medium text-gray-900">Good lighting</p>
                <p className="text-gray-500 mt-0.5">Make sure the recipe is well-lit and clearly visible.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
              <div className="pt-0.5">
                <p className="font-medium text-gray-900">Straight angle</p>
                <p className="text-gray-500 mt-0.5">Take the photo from directly above for best text recognition.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
              <div className="pt-0.5">
                <p className="font-medium text-gray-900">Review & edit</p>
                <p className="text-gray-500 mt-0.5">You can edit any details after the AI extracts the recipe.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Sparkles className="w-4 h-4" />
          <span>Powered by AI text recognition</span>
        </div>
      </div>
    </div>
  );
}
