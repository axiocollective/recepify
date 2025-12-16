'use client';

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Clipboard, CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";

type TemplateIngredient = { item: string; amount: string | null };
type TemplateRecipe = {
  title: string;
  description: string | null;
  servings: string | null;
  prep_time: string | null;
  cook_time: string | null;
  total_time: string | null;
  ingredients: TemplateIngredient[];
  steps: string[];
  notes: string[];
};

type ScanResponse = {
  raw_text: string;
  recipe?: TemplateRecipe | null;
  template_error?: string | null;
};

const allowedExtensions = ".jpg,.jpeg,.png,.heic,.heif";

export default function ScanPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [structuredRecipe, setStructuredRecipe] = useState<TemplateRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setStructuredRecipe(null);
      setTemplateError(null);
      resetPreview();
      return;
    }
    setSelectedFile(file);
    setError(null);
    setRawText("");
    setCopied(false);
    setStructuredRecipe(null);
    setTemplateError(null);
    resetPreview();
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please choose an image before scanning.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setRawText("");
    setTemplateError(null);
    setStructuredRecipe(null);
    setCopied(false);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const detail = body?.error ?? response.statusText;
        throw new Error(typeof detail === "string" ? detail : "Failed to scan image.");
      }

      const data = (await response.json()) as ScanResponse;
      setRawText(data.raw_text ?? "");
      setStructuredRecipe(data.recipe ?? null);
      setTemplateError(data.template_error ?? null);
      if (!data.raw_text) {
        setError("Scan completed but no text was detected. Try a clearer photo.");
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Unable to scan image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy text to clipboard.");
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setRawText("");
    setError(null);
    setTemplateError(null);
    setStructuredRecipe(null);
    setCopied(false);
    resetPreview();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 border-b border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            onClick={() => history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Recipefy Labs</p>
            <h1 className="text-xl font-semibold">Scan Recipes</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
            Scan · Structure · Save
          </span>
          <h2 className="text-3xl font-semibold">Turn any recipe card into clean, editable text</h2>
          <p className="text-gray-500">
            Upload a cookbook page, handwritten heirloom, or magazine spread. We’ll capture the text and convert it into a structured template you can copy anywhere.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-gray-100 bg-white/60 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <label className="block text-sm font-medium text-gray-700">Recipe image</label>
            <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center transition hover:border-gray-300 cursor-pointer bg-white">
              <Camera className="h-10 w-10 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile ? "Change photo" : "Tap to upload or take a photo"}</p>
                <p className="text-sm text-gray-500">JPG, PNG, HEIC · up to 8MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={allowedExtensions}
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {previewUrl && (
              <div className="relative overflow-hidden rounded-2xl border border-gray-200">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  width={1200}
                  height={800}
                  className="w-full h-auto object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={clearSelection}
                  className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow"
                >
                  Remove
                </button>
                {isLoading && (
                  <div className="absolute inset-0 bg-gray-900/40 backdrop-blur flex items-center justify-center">
                    <div className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-gray-700 flex items-center gap-2 shadow">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scanning…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {templateError && !error && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {templateError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={isLoading || !selectedFile}
              className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-white shadow-lg transition hover:bg-gray-900 disabled:opacity-60"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Scanning…" : "Scan image"}
            </button>
            <p className="text-sm text-gray-500">
              Tip: place your recipe card on a flat surface with even lighting for best results.
            </p>
          </div>
        </form>

        <section className="space-y-3 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Extracted text</h2>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!rawText}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Clipboard className="h-4 w-4" />
                  Copy text
                </>
              )}
            </button>
          </div>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={isLoading ? "Scanning…" : "Your extracted recipe will appear here."}
            rows={12}
            className="w-full rounded-2xl border border-gray-200 p-4 font-mono text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          />
        </section>

        {structuredRecipe && (
          <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-gray-900">{structuredRecipe.title || "Untitled Recipe"}</h2>
              {structuredRecipe.description && <p className="text-gray-600">{structuredRecipe.description}</p>}
            </div>
            <div className="grid gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-3">
              <div>
                <p className="text-gray-500">Servings</p>
                <p className="font-medium">{structuredRecipe.servings || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Prep / Cook</p>
                <p className="font-medium">
                  {(structuredRecipe.prep_time || "—") + " / " + (structuredRecipe.cook_time || "—")}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Total time</p>
                <p className="font-medium">{structuredRecipe.total_time || "—"}</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">Ingredients</h3>
                <ul className="space-y-2 text-sm text-gray-800">
                  {structuredRecipe.ingredients.length === 0 && <li className="text-gray-500">No ingredients detected.</li>}
                  {structuredRecipe.ingredients.map((ingredient, index) => (
                    <li key={`${ingredient.item}-${index}`} className="flex gap-2">
                      {ingredient.amount && <span className="font-medium">{ingredient.amount}</span>}
                      <span>{ingredient.item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">Steps</h3>
                <ol className="space-y-3 text-sm text-gray-800">
                  {structuredRecipe.steps.length === 0 && <li className="text-gray-500">No steps detected.</li>}
                  {structuredRecipe.steps.map((step, index) => (
                    <li key={`${step}-${index}`} className="flex gap-3">
                      <span className="text-gray-400">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {structuredRecipe.notes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-gray-900">Notes</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {structuredRecipe.notes.map((note, index) => (
                    <li key={`${note}-${index}`}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6 text-sm text-gray-600">
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Tips for best results
          </h3>
          <div className="space-y-3">
            {["Shoot in bright, even lighting", "Keep the camera steady directly above the recipe", "Fill the frame so the text is large and sharp"].map(
              (tip, index) => (
                <p key={tip} className="flex gap-3">
                  <span className="font-semibold text-gray-400">{index + 1}.</span>
                  <span>{tip}</span>
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
