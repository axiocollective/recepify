'use client';

import { useState } from "react";
import { RecipeEdit } from "@/components/figma/RecipeEdit";
import { Button } from "@/components/ui/button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recipe } from "@/types/figma";
import { getImportSourceMeta } from "@/lib/import-source";

const generateDraftId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `draft-${crypto.randomUUID()}`;
  }
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
};

const createManualDraft = (): Recipe => {
  const draftId = generateDraftId();
  return {
    id: draftId,
    title: "",
    description: "",
    ingredients: [
      {
        id: `${draftId}-ingredient-1`,
        line: "",
      },
    ],
    steps: [""],
    tags: [],
    source: "web",
  };
};

export default function AddRecipePage() {
  const [importUrl, setImportUrl] = useState("");
  const [manualDraft, setManualDraft] = useState<Recipe | null>(null);
  const importMeta = getImportSourceMeta(importUrl);
  const canImport = Boolean(importUrl.trim());

  const handleManualStart = () => {
    setManualDraft(createManualDraft());
  };

  const handleManualBack = () => {
    setManualDraft(null);
  };

  const handleManualSave = (updatedRecipe: Recipe) => {
    console.log("Manual recipe saved", updatedRecipe);
    setManualDraft(null);
  };

  if (manualDraft) {
    return <RecipeEdit recipe={manualDraft} onBack={handleManualBack} onSave={handleManualSave} />;
  }

  const handleSmartImport = () => {
    if (!canImport) return;
    console.log("Smart import triggered", importUrl.trim(), importMeta.id);
    setImportUrl("");
  };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Add Recipe</p>
        <h1 className="text-3xl font-semibold tracking-tight">Add Recipe</h1>
        <p className="mt-2 text-muted-foreground">
          Drop a link or start from scratch—RecepiFy figures out the best import path automatically.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-purple-600 via-fuchsia-500 to-orange-400 text-white shadow-xl">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top,_#ffffff,_transparent_60%)] pointer-events-none" />
          <CardHeader className="space-y-1 text-white relative z-10">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">Smart import</p>
            <CardTitle className="text-2xl font-semibold">One field for every source</CardTitle>
            <p className="text-sm text-white/80">
              Drop a link from TikTok, Pinterest, or any website and RecepiFy routes it to the right importer.
            </p>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <div className="rounded-2xl border border-white/30 bg-white/10 backdrop-blur-md p-4 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-3 py-1 rounded-full font-semibold ${importMeta.accentClassName}`}>
                  {importUrl ? `${importMeta.label} link` : "Source auto-detect"}
                </span>
                <span className="text-white/70">
                  {importUrl ? "Detected automatically" : "Waiting for link"}
                </span>
              </div>
              <p className="text-sm text-white/80">
                Drop a link from TikTok, Pinterest or any website and I&apos;ll convert it into a recipe in seconds.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder="https://tiktok.com/… or https://favoriteblog.com/recipe"
                  className="flex-1 rounded-xl border border-white/30 bg-white/95 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                />
                <Button
                  disabled={!canImport}
                  onClick={handleSmartImport}
                  className="w-full sm:w-auto shrink-0 rounded-xl bg-white text-gray-900 hover:bg-gray-100 disabled:bg-white/40 disabled:text-white/60"
                >
                  Convert Recipe
                </Button>
              </div>
              <p className="text-xs text-white/80">{importMeta.helper}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Manually</CardTitle>
            <p className="text-sm text-muted-foreground">
              Start from a blank recipe and fill in the ingredients, steps, photos, and notes yourself.
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleManualStart} className="w-full justify-center">
              Add Manually
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base font-semibold">How to add recipes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste your link once—the importer detects if it&apos;s TikTok, Pinterest, or a regular website and uses the right capture flow automatically.
            Need total control today? Tap Add Manually to open a blank editor and build the recipe yourself.
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
