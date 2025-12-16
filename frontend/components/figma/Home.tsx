'use client';

import NextImage from "next/image";
import { useMemo, useState } from "react";
import {
  Heart,
  Clock,
  ArrowRight,
  Sparkles,
  Send,
  X,
  Flame,
} from "lucide-react";
import type { Recipe, Screen } from "@/types/figma";
import type { RecipeFinderCandidatePayload } from "@/types/assistant";
import { PlaceholderThumbnail } from "@/components/placeholder-thumbnail";
import { ImportQuickActions } from "@/components/figma/ImportQuickActions";
import { askRecipeAssistant, askRecipeFinder } from "@/lib/api";

const PREDEFINED_TAGS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
  "Appetizer",
  "Salad",
  "Soup",
  "Stew",
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Keto",
  "Low-Carb",
  "High-Protein",
  "Meat",
  "Poultry",
  "Seafood",
  "Spicy",
  "Quick",
  "Healthy",
  "Comfort Food",
  "BBQ",
  "Grill",
  "Side Dish",
  "Meal Prep",
  "Budget-Friendly",
  "Kids-Friendly",
  "One-Pot",
];

interface HomeProps {
  onNavigate: (screen: Screen) => void;
  importQueueCount: number;
  recentRecipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
  allRecipes: Recipe[];
  onAddManual: () => void;
  userName?: string;
  onQuickFilter: (tag: string) => void;
  inboxCount?: number;
}

type AssistantRole = "user" | "assistant";

type AssistantMessage = {
  role: AssistantRole;
  text: string;
  recipes?: Recipe[];
};

const stripCodeFences = (text: string): string => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) {
    return match[1].trim();
  }
  return text.trim();
};

const removeTrailingCommas = (jsonLike: string): string =>
  jsonLike.replace(/,\s*(}|\])/g, "$1");

const extractJsonObject = (raw: string) => {
  const text = stripCodeFences(raw);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          const slice = removeTrailingCommas(text.slice(start, index + 1));
          try {
            return JSON.parse(slice);
          } catch {
            start = -1;
          }
        }
      }
    }
  }
  return null;
};

const splitSectionLines = (value: string): string[] => {
  const parts = value
    .replace(/\s+-\s+/g, "\n- ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (parts.length > 1 && !parts[0].startsWith("-")) {
    parts[0] = `- ${parts[0]}`;
  }
  return parts.map((line) =>
    line.startsWith("-") ? `- ${line.replace(/^-+\s*/, "")}` : line
  );
};

const formatBoldSegments = (text: string): string => {
  if (!text.includes("**")) {
    return text;
  }
  return text.replace(/\*\*(.*?)\*\*/g, (_, inner) => `**${inner.trim()}**`);
};

const ensureTitleLineBreaks = (text: string): string =>
  text.replace(/(\*\*[^*]+?\*\*)[ \t]*/g, "$1\n");

const buildMarkdownFromSections = (sections: { title?: string; content?: string[] }[]): string | null => {
  if (!sections.length) {
    return null;
  }
  const seen = new Set<string>();
  const formatted = sections.slice(0, 3).flatMap((section, index) => {
    const title = (section.title ?? "ChefGPT").trim() || `ChefGPT ${index + 1}`;
    const hashKey = `${title}::${JSON.stringify(section.content ?? [])}`;
    if (seen.has(hashKey)) {
      return [];
    }
    seen.add(hashKey);
    const lines = (section.content ?? [])
      .flatMap((line) => (typeof line === "string" ? splitSectionLines(line) : []))
      .slice(0, 4);
    const body = lines.length
      ? lines.map((line) => (line.startsWith("-") ? line : line)).join("\n")
      : "Still gathering helpful notes.";
    return `**${title}**\n${body}`;
  });
  if (!formatted.length) {
    return null;
  }
  return ensureTitleLineBreaks(formatBoldSegments(formatted.join("\n\n")));
};

const formatAssistantReply = (reply: string): string => {
  const cleaned = stripCodeFences(reply).trim();
  if (!cleaned) {
    return "I'm not sure how to help with that. Try asking about flavors, substitutions, or cooking tips.";
  }
  try {
    const parsed = extractJsonObject(cleaned);
    if (parsed && Array.isArray(parsed.sections)) {
      const markdown = buildMarkdownFromSections(parsed.sections);
      if (markdown) {
        const words = markdown.replace(/\*\*/g, "").split(/\s+/).filter(Boolean);
        if (words.length > 120) {
          return `${words.slice(0, 120).join(" ")}…`;
        }
        return markdown;
      }
    }
  } catch {
    // fall back to plain text
  }
  return ensureTitleLineBreaks(formatBoldSegments(cleaned));
};

const SENSITIVE_QUESTION_PATTERNS: RegExp[] = [
  /\bmedical\b/i,
  /\bmedicine\b/i,
  /\bdiagnos/i,
  /\bprescription\b/i,
  /\bmedication\b/i,
  /\ballerg/i,
  /\bpregnan/i,
  /\bbaby\b/i,
  /\binfant\b/i,
  /\bchild\b/i,
  /\btoddler\b/i,
  /\bdoctor\b/i,
  /\bhealth (?:issue|problem)\b/i,
  /\bpoison\b/i,
  /\btoxic\b/i,
  /\bfoodborne\b/i,
  /\bblood pressure\b/i,
  /\bdiabet/i,
  /\bcholesterol\b/i,
];

const isSensitiveQuestion = (question: string): boolean =>
  SENSITIVE_QUESTION_PATTERNS.some((pattern) => pattern.test(question.toLowerCase()));

const SENSITIVE_RESPONSE =
  "I’m not able to help with that. Please speak with a doctor or qualified professional for medical or safety advice.";

export function Home({
  onNavigate,
  importQueueCount,
  recentRecipes,
  onRecipeSelect,
  allRecipes,
  onAddManual,
  userName = "Andreas",
  onQuickFilter,
  inboxCount = 0,
}: HomeProps) {
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const firstName = userName.split(" ")[0] || userName;
  const MAX_USER_MESSAGES = 5;
  const assistantLibraryPrompt =
    "You are ChefGPT (BETA), Recipefy's AI sous-chef. You are answering questions about the user's personal recipe library. " +
    "Always reference the provided catalog entries (title, tags, ingredients, steps, nutrition) and cite specific recipes by name. " +
    "Respond ONLY in JSON matching {\"sections\": [{\"title\": \"Title\", \"content\": [\"- bullet\", \"sentence\"]}]} with at most three sections. " +
    "Keep answers under 120 words unless the user explicitly requests detailed instructions. " +
    "Use warm, encouraging language and avoid redundancy.";

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const favoriteRecipes = allRecipes.filter((recipe) => recipe.isFavorite);

  const picksOfTheDay = useMemo(() => {
    const today = new Date().toDateString();
    const seed = today.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const shuffled = [...allRecipes].sort(() => 0.5 - ((seed % 1000) / 1000));
    return shuffled.slice(0, 4);
  }, [allRecipes]);

  const customTags = useMemo(() => {
    const normalizedDefaults = new Set(PREDEFINED_TAGS.map((tag) => tag.toLowerCase()));
    const extras = new Set<string>();
    allRecipes.forEach((recipe) => {
      (recipe.tags || []).forEach((tag) => {
        const trimmed = tag?.trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        if (!normalizedDefaults.has(lower)) {
          extras.add(trimmed);
        }
      });
    });
    return Array.from(extras).sort((a, b) => a.localeCompare(b));
  }, [allRecipes]);
  const quickTags = [...PREDEFINED_TAGS, ...customTags];
  const finderCandidates = useMemo(() => buildRecipeFinderCandidates(allRecipes), [allRecipes]);
  const isSendDisabled = isAssistantThinking || !inputText.trim();

  const handleSendMessage = async (overrideText?: string) => {
    const question = (overrideText ?? inputText).trim();
    if (!question || isAssistantThinking) {
      return;
    }
    const userMessagesCount = messages.filter((message) => message.role === "user").length;
    if (userMessagesCount >= MAX_USER_MESSAGES) {
      setInputText("");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "You've reached the limit of five questions. Give me a break—I’m only a beta sous chef!",
        },
      ]);
      return;
    }

    const userMessage: AssistantMessage = { role: "user", text: question };
    setInputText("");

    if (isSensitiveQuestion(question)) {
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          role: "assistant",
          text: SENSITIVE_RESPONSE,
        },
      ]);
      return;
    }

    const conversationHistory = messages.map(({ role, text }) => ({
      role,
      content: text,
    }));
    const thinkingMessage: AssistantMessage = { role: "assistant", text: "ChefGPT is thinking…" };
    setAssistantError(null);
    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setIsAssistantThinking(true);

    const showFallbackResponse = (reason?: "empty" | "error") => {
      const fallback = generateAssistantResponse(question, allRecipes, picksOfTheDay);
      if (reason === "error") {
        setAssistantError("ChefGPT is offline right now. Showing smart suggestions instead.");
      } else if (reason === "empty") {
        setAssistantError("Add more recipes to get personalized answers from ChefGPT.");
      }
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", text: fallback.response, recipes: fallback.recipes },
      ]);
    };

    if (!finderCandidates.length) {
      showFallbackResponse("empty");
      setIsAssistantThinking(false);
      return;
    }

    try {
      const finderResponse = await askRecipeFinder({
        query: question,
        recipes: finderCandidates,
      });

      const matchingRecipes =
        finderResponse.matches
          ?.map((match) => allRecipes.find((recipe) => recipe.id === match.id))
          .filter((recipe): recipe is Recipe => Boolean(recipe)) ?? [];

      const contextRecipes =
        matchingRecipes.length > 0 ? matchingRecipes : allRecipes.slice(0, 3);
      const catalog = buildRecipeCatalog(contextRecipes);

      const response = await askRecipeAssistant({
        recipe: {
          title: "Recipefy Library",
          description: "Multiple recipes from the user library.",
          tags: [],
          ingredients: [],
          steps: [],
        },
        messages: [
          { role: "assistant", content: assistantLibraryPrompt },
          ...conversationHistory,
          { role: "assistant", content: `Recipe catalog snapshot:\n${catalog}` },
          { role: "user", content: question },
        ],
      });
      const reply = formatAssistantReply(response.reply);
      const suggestedRecipes =
        matchingRecipes.length > 0 ? matchingRecipes : picksOfTheDay.slice(0, 3);

      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          text: reply,
          recipes: suggestedRecipes,
        },
      ]);
    } catch (assistantFailure) {
      console.error(assistantFailure);
      showFallbackResponse("error");
    } finally {
      setIsAssistantThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="px-6 pt-8 pb-6">
        <h1 className="text-4xl mb-1.5">
          {greeting()}, {firstName}.
        </h1>
        <p className="text-lg text-gray-500">What would you like to cook today?</p>
      </div>

      <div className="px-6 mb-4">
        <button
          onClick={() => setIsAIAssistantOpen(true)}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl p-5 flex items-center justify-between hover:from-purple-600 hover:to-purple-700 transition-all group shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="text-base font-medium flex items-center gap-2">
                ChefGPT <span className="text-xs uppercase tracking-wide text-white/70">BETA</span>
              </p>
              <p className="text-sm text-white/80">I&apos;m your AI-powered sous chef</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="mb-10">
        <div className="px-6 mb-4">
          <h2 className="text-sm text-gray-600">Quick filters</h2>
        </div>
        <div className="flex gap-3 px-6 overflow-x-auto no-scrollbar pb-1">
          {quickTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onQuickFilter(tag)}
              className="flex-shrink-0 px-4 py-2 rounded-full bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <ImportQuickActions
          onNavigate={(screen) => onNavigate(screen)}
          onAddManually={onAddManual}
          inboxCount={inboxCount}
        />
      </div>
      {importQueueCount > 0 && (
        <p className="px-6 -mt-6 mb-8 text-sm text-gray-500">
          {importQueueCount} {importQueueCount === 1 ? "import" : "imports"} in progress
        </p>
      )}

      <div className="px-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-medium">Today&apos;s Picks</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {picksOfTheDay.map((recipe, index) => (
            <PickCard key={recipe.id} recipe={recipe} onClick={() => onRecipeSelect(recipe)} index={index} />
          ))}
        </div>
      </div>

      {favoriteRecipes.length > 0 && (
        <div className="px-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              <h2 className="text-xl font-medium">Your Favorites</h2>
            </div>
            <button onClick={() => onNavigate("myRecipes")} className="text-sm text-gray-500 hover:text-black transition-colors">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {favoriteRecipes.slice(0, 3).map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => onRecipeSelect(recipe)} />
            ))}
          </div>
        </div>
      )}

      {recentRecipes.length > 0 && (
        <div className="px-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Recently added</h2>
            <button onClick={() => onNavigate("myRecipes")} className="text-sm text-gray-500 hover:text-black transition-colors">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {recentRecipes.slice(0, 3).map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => onRecipeSelect(recipe)} />
            ))}
          </div>
        </div>
      )}

      {isAIAssistantOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end" onClick={() => setIsAIAssistantOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "85vh" }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-medium flex items-center gap-2">
                    ChefGPT <span className="text-[10px] uppercase tracking-wide text-gray-400">BETA</span>
                  </h3>
                  <p className="text-xs text-gray-500">I&apos;m your AI-powered sous chef</p>
                </div>
              </div>
              <button onClick={() => setIsAIAssistantOpen(false)} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-purple-600" />
                  </div>
                  <h4 className="text-base font-medium mb-2">How can I help you today?</h4>
                  <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                    Ask me anything about your recipes—from prep and substitutions to serving tweaks. I&apos;m still in beta, so treat my answers as helpful guidance, not absolute truth.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center px-4">
                    {["Quick dinner ideas", "Healthy recipes", "What&apos;s for breakfast?", "Italian favorites", "Easy desserts"].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSendMessage(suggestion)}
                        className="px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-xs transition-colors border border-gray-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`}>
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${message.role === "user" ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}>
                      {message.text}
                    </div>
                  </div>
                  {message.recipes && message.recipes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.recipes.map((recipe) => (
                        <button
                          key={recipe.id}
                          onClick={() => {
                            onRecipeSelect(recipe);
                            setIsAIAssistantOpen(false);
                          }}
                          className="w-full flex gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                        >
                          <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} className="w-14 h-14 rounded-lg flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium mb-1 line-clamp-1">{recipe.title}</h3>
                            {recipe.totalTime && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>{recipe.totalTime}</span>
                              </div>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400 self-center" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {assistantError && (
                <p className="text-xs text-red-500">{assistantError}</p>
              )}
              {messages.length > 0 && (
                <p className="text-[11px] text-gray-400 text-center px-4">
                  ChefGPT is powered by AI. Responses may contain mistakes—double-check important details.
                </p>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isSendDisabled) {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isSendDisabled}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                    !isSendDisabled
                      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-lg"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const buildRecipeFinderCandidates = (recipes: Recipe[]): RecipeFinderCandidatePayload[] => {
  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? "",
    tags: recipe.tags ?? [],
    prepTime: recipe.prepTime ?? recipe.duration,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime ?? recipe.duration,
    category: recipe.category,
    ingredients: (recipe.ingredients ?? [])
      .map(formatIngredientForFinder)
      .filter((line) => line.length > 0),
    steps: (recipe.steps ?? [])
      .map((step) => step?.trim())
      .filter((step): step is string => Boolean(step && step.length > 0)),
    notes: recipe.notes ?? undefined,
    nutritionCalories: formatNutritionValue(recipe.nutrition?.calories),
    nutritionProtein: formatNutritionValue(recipe.nutrition?.protein),
    nutritionCarbs: formatNutritionValue(recipe.nutrition?.carbs),
    nutritionFat: formatNutritionValue(recipe.nutrition?.fat),
    isFavorite: Boolean(recipe.isFavorite),
  }));
};

const formatIngredientForFinder = (ingredient?: Recipe["ingredients"][number]): string => {
  if (!ingredient) {
    return "";
  }
  if (ingredient.line?.trim()) {
    return ingredient.line.trim();
  }
  return [ingredient.amount, ingredient.name].filter(Boolean).join(" ").trim();
};

const formatNutritionValue = (value?: string | number | null): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const generateAssistantResponse = (
  question: string,
  recipes: Recipe[],
  picksOfTheDay: Recipe[]
): { response: string; recipes?: Recipe[] } => {
  const lower = question.toLowerCase();
  let filtered: Recipe[] = [];

  const pick = (predicate: (recipe: Recipe) => boolean) => recipes.filter(predicate).slice(0, 3);

  if (lower.includes("schnell") || lower.includes("fast") || lower.includes("quick")) {
    filtered = pick((recipe) => {
      const hasQuickTag = recipe.tags?.some((tag) => tag.toLowerCase() === "quick") ?? false;
      const hasShortTime =
        typeof recipe.totalTime === "string" && Number.parseInt(recipe.totalTime, 10) < 30;
      return hasQuickTag || hasShortTime;
    });
    return {
      response: "Hier sind schnelle Rezepte, die du in unter 30 Minuten zubereiten kannst:",
      recipes: filtered,
    };
  }

  if (lower.includes("vegetarisch") || lower.includes("vegetarian")) {
    filtered = pick((recipe) => recipe.tags?.some((tag) => tag.toLowerCase() === "vegetarian") ?? false);
    return {
      response: "Ich habe diese vegetarischen Rezepte für dich gefunden:",
      recipes: filtered,
    };
  }

  if (lower.includes("gesund") || lower.includes("healthy")) {
    filtered = pick((recipe) => recipe.tags?.some((tag) => tag.toLowerCase() === "healthy") ?? false);
    return {
      response: "Gesunde Rezept-Optionen aus deiner Sammlung:",
      recipes: filtered,
    };
  }

  if (lower.includes("frühstück") || lower.includes("breakfast")) {
    filtered = pick(
      (recipe) =>
        recipe.category === "Breakfast" ||
        (recipe.tags?.some((tag) => tag.toLowerCase() === "breakfast") ?? false)
    );
    return {
      response: "Perfekt für ein leckeres Frühstück:",
      recipes: filtered,
    };
  }

  if (lower.includes("dessert") || lower.includes("nachtisch")) {
    filtered = pick(
      (recipe) =>
        recipe.category === "Dessert" ||
        (recipe.tags?.some((tag) => tag.toLowerCase() === "dessert") ?? false)
    );
    return {
      response: "Süße Dessert-Ideen für dich:",
      recipes: filtered,
    };
  }

  if (lower.includes("einfach") || lower.includes("easy")) {
    filtered = pick(
      (recipe) => recipe.difficulty === "easy" || (recipe.tags?.some((tag) => tag.toLowerCase() === "easy") ?? false)
    );
    return {
      response: "Diese einfachen Rezepte sind perfekt für Anfänger:",
      recipes: filtered,
    };
  }

  if (lower.includes("favoriten") || lower.includes("favorites")) {
    filtered = pick((recipe) => Boolean(recipe.isFavorite));
    return {
      response: "Deine Lieblings-Rezepte:",
      recipes: filtered,
    };
  }

  if (lower.includes("italian") || lower.includes("italienisch")) {
    filtered = pick((recipe) => recipe.tags?.some((tag) => tag.toLowerCase() === "italian") ?? false);
    return {
      response: "Italienische Rezepte aus deiner Sammlung:",
      recipes: filtered,
    };
  }

  filtered = picksOfTheDay.slice(0, 3);
  return {
    response:
      "Ich kann dir helfen, das perfekte Rezept zu finden! Frag mich nach: schnellen Rezepten, gesunden Gerichten, Frühstücksideen, oder deinen Favoriten. Hier sind ein paar Vorschläge für dich:",
    recipes: filtered,
  };
};

const buildRecipeCatalogEntry = (recipe: Recipe): string => {
  const lines: string[] = [
    `Title: ${recipe.title}`,
    recipe.description ? `Description: ${recipe.description.slice(0, 160)}` : undefined,
    recipe.category ? `Meal: ${recipe.category}` : undefined,
    recipe.totalTime ? `Total time: ${recipe.totalTime}` : undefined,
    recipe.tags?.length ? `Tags: ${recipe.tags.join(", ")}` : undefined,
    recipe.ingredients.length
      ? `Ingredients:\n${recipe.ingredients
          .slice(0, 6)
          .map((ingredient) => `- ${formatIngredientForFinder(ingredient)}`)
          .join("\n")}`
      : undefined,
    recipe.steps.length
      ? `Steps:\n${recipe.steps
          .slice(0, 3)
          .map((step, index) => `${index + 1}. ${step.slice(0, 120)}`)
          .join("\n")}`
      : undefined,
    recipe.nutrition?.calories ? `Calories: ${recipe.nutrition.calories}` : undefined,
  ].filter(Boolean) as string[];
  return lines.join("\n");
};

const buildRecipeCatalog = (recipes: Recipe[]): string =>
  recipes
    .slice(0, 6)
    .map((recipe, index) => `${index + 1})\n${buildRecipeCatalogEntry(recipe)}`)
    .join("\n\n");

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button onClick={onClick} className="w-full flex gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-all text-left">
      <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} className="w-16 h-16 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm mb-1 line-clamp-2">{recipe.title}</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {(recipe.totalTime || recipe.duration) && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{recipe.totalTime ?? recipe.duration}</span>
            </div>
          )}
          {recipe.isFavorite && <Heart className="w-3 h-3 fill-black text-black" />}
        </div>
      </div>
    </button>
  );
}

interface PickCardProps {
  recipe: Recipe;
  onClick: () => void;
  index: number;
}

function PickCard({ recipe, onClick, index }: PickCardProps) {
  const gradients = ["from-orange-500/10 to-red-500/10", "from-purple-500/10 to-pink-500/10", "from-blue-500/10 to-cyan-500/10", "from-green-500/10 to-emerald-500/10"];
  const gradient = gradients[index % gradients.length];

  return (
    <button onClick={onClick} className="w-full text-left group">
      <div className={`relative aspect-square rounded-2xl overflow-hidden mb-2 shadow-sm group-hover:shadow-md transition-all bg-gradient-to-br ${gradient}`}>
        <RecipeThumbnail imageUrl={recipe.thumbnail} title={recipe.title} className="w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
        {recipe.isFavorite && (
          <div className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2">
          {(recipe.totalTime || recipe.duration) && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-white text-xs">
              <Clock className="w-3 h-3" />
              <span>{recipe.totalTime ?? recipe.duration}</span>
            </div>
          )}
        </div>
      </div>
      <h3 className="text-sm font-medium line-clamp-2 group-hover:text-gray-600 transition-colors">{recipe.title}</h3>
    </button>
  );
}

interface RecipeThumbnailProps {
  imageUrl?: string | null;
  title: string;
  className?: string;
}

function RecipeThumbnail({ imageUrl, title, className = "" }: RecipeThumbnailProps) {
  const wrapperClass = `relative overflow-hidden ${className}`;
  if (!imageUrl) {
    return <PlaceholderThumbnail className={className} />;
  }

  return (
    <div className={wrapperClass}>
      <NextImage src={imageUrl} fill sizes="150px" alt={title} className="object-cover" />
    </div>
  );
}
