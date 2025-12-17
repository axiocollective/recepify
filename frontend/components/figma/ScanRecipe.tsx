'use client';

import NextImage from "next/image";
import { ArrowLeft, Camera, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
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
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Scan Recipe</h1>
      </div>

      <div className="px-6 py-12 max-w-md mx-auto">
        {previewImage ? (
          <div className="mb-8">
            <div className="relative rounded-2xl overflow-hidden border border-gray-200">
              <NextImage
                src={previewImage}
                alt="Recipe preview"
                width={1400}
                height={1000}
                className="w-full h-auto object-cover"
                unoptimized
              />
              {isScanning && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-lg">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-medium text-sm text-gray-900">{message || "Scanning recipe..."}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-medium mb-3">Scan anything</h2>
              <p className="text-gray-500 max-w-xs mx-auto leading-relaxed mb-1">
                Capture handwritten recipes from grandma, cookbook pages, recipe cards, or any printed recipe.
              </p>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Our AI will extract all the details for you.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isScanning}
                />
                <div className="border border-gray-200 rounded-2xl p-5 flex items-center gap-4 hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer">
                  <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Camera className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">Take a photo</p>
                    <p className="text-sm text-gray-500">Open camera to capture recipe</p>
                  </div>
                </div>
              </label>

              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isScanning}
                />
                <div className="border border-gray-200 rounded-2xl p-5 flex items-center gap-4 hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer">
                  <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">Choose from gallery</p>
                    <p className="text-sm text-gray-500">Select an existing photo</p>
                  </div>
                </div>
              </label>
            </div>
          </>
        )}

        {!previewImage && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Tips for best results</h3>
            <div className="space-y-4 text-sm">
              {[
                {
                  title: "Good lighting",
                  subtitle: "Ensure recipe is well-lit and clearly visible",
                },
                {
                  title: "Straight angle",
                  subtitle: "Photo from directly above works best",
                },
                {
                  title: "Review & edit",
                  subtitle: "Edit any details after AI extraction",
                },
              ].map((tip, index) => (
                <div key={tip.title} className="flex gap-3">
                  <span className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-gray-900">{tip.title}</p>
                    <p className="text-gray-500 mt-0.5">{tip.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400">
              <Sparkles className="w-4 h-4" />
              <span>Powered by AI text recognition</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-6">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
