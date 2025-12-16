import { notFound } from "next/navigation";
import Image from "next/image";
import { Clock, Users, Tag } from "lucide-react";
import type { RecipeReadPayload } from "@/lib/api";
import type { RecipeIngredient } from "@/types/figma";
import { formatIngredientText } from "@/lib/utils";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function fetchRecipeShare(id: string): Promise<RecipeReadPayload> {
  const response = await fetch(`${API_BASE_URL}/api/recipes/${id}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load recipe.");
  }
  return (await response.json()) as RecipeReadPayload;
}

interface SharePageProps {
  params: { id: string };
}

export default async function ShareRecipePage({ params }: SharePageProps) {
  const recipe = await fetchRecipeShare(params.id);

  const tags = recipe.tags ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-3">Recepify Share</p>
          <h1 className="text-3xl font-semibold text-gray-900">{recipe.title}</h1>
          {recipe.description && (
            <p className="mt-3 text-gray-600">{recipe.description}</p>
          )}
        </div>

        {recipe.mediaImageUrl && (
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg mb-8">
            <Image
              src={recipe.mediaImageUrl}
              alt={recipe.title}
              fill
              sizes="600px"
              className="object-cover"
            />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4 mb-4">
              {recipe.totalTime && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{recipe.totalTime}</span>
                </div>
              )}
              {recipe.servings && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{recipe.servings} servings</span>
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Ingredients</h2>
            {recipe.ingredients.length ? (
              <ul className="space-y-2 text-gray-700">
                {recipe.ingredients.map((ingredient) => {
                  const normalizedIngredient: RecipeIngredient = {
                    id: ingredient.id,
                    line: ingredient.line ?? undefined,
                    amount: ingredient.amount ?? undefined,
                    name: ingredient.name ?? undefined,
                  };
                  return (
                    <li key={ingredient.id} className="flex gap-2">
                      <span className="text-gray-400">•</span>
                      <span>{ingredient.line || formatIngredientText(normalizedIngredient)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No ingredients provided.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h2>
            {recipe.instructions.length ? (
              <ol className="space-y-3 text-gray-700 list-decimal list-inside">
                {recipe.instructions.map((step) => (
                  <li key={step.id} className="leading-relaxed">{step.text}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No steps provided.</p>
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-medium text-gray-600">Tags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-10 text-sm text-gray-500">
          <p>Shared from recepify – the easiest way to save and organize recipes.</p>
        </div>
      </div>
    </div>
  );
}
