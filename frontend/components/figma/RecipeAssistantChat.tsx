'use client';

import { AlertTriangle, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { askRecipeAssistant } from "@/lib/api";
import type { Recipe as FigmaRecipe } from "@/types/figma";
import type {
  RecipeAssistantMessage,
  RecipeAssistantRecipePayload,
} from "@/types/assistant";
import { formatIngredientText } from "@/lib/utils";

interface RecipeAssistantChatProps {
  recipe: FigmaRecipe;
}

interface ChatMessage extends RecipeAssistantMessage {
  id: string;
}

type MessageBlock =
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Math.random().toString(36).slice(2, 9)}`;
};

const initialAssistantMessage: ChatMessage = {
  id: "assistant-intro",
  role: "assistant",
  content:
    "Ask me anything about this recipe. Quick tips, changes, or questions? I’ll help you make it perfect.",
};

const LIMIT_MESSAGE = "* You have reached your conversation limit.";

const toAssistantRecipePayload = (recipe: FigmaRecipe): RecipeAssistantRecipePayload => ({
  title: recipe.title,
  description: recipe.description,
  servings: recipe.servings ? String(recipe.servings) : undefined,
  prepTime: recipe.prepTime,
  cookTime: recipe.cookTime,
  totalTime: recipe.totalTime,
  difficulty: recipe.difficulty,
  mealType: recipe.category,
  source: recipe.source,
  tags: recipe.tags ?? [],
  notes: recipe.notes,
  ingredients: recipe.ingredients
    .map((ingredient) => formatIngredientText(ingredient))
    .filter((value): value is string => Boolean(value && value.trim())),
  steps: recipe.steps,
});

export function RecipeAssistantChat({ recipe }: RecipeAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [limitNoticeShown, setLimitNoticeShown] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const payload = useMemo(() => toAssistantRecipePayload(recipe), [recipe]);

  useEffect(() => {
    setMessages([initialAssistantMessage]);
    setInput("");
    setIsOpen(false);
    setError(null);
    setIsSending(false);
    setQuestionCount(0);
    setLimitNoticeShown(false);
  }, [recipe.id]);

  useEffect(() => {
    if (questionCount >= 3 && !limitNoticeShown) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: LIMIT_MESSAGE,
        },
      ]);
      setLimitNoticeShown(true);
    }
  }, [questionCount, limitNoticeShown]);

  const parseBlocks = (content: string): MessageBlock[] => {
    const normalized = content.replace(/\r\n?/g, "\n").trim();
    if (!normalized) return [];
    const segments = normalized.split(/\n{2,}/).map((segment) => segment.trim());
    return segments
      .map((segment) => {
        const lines = segment
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isList = lines.every((line) => /^[-*•]\s+/.test(line));
        if (isList) {
          return { type: "list", items: lines.map((line) => line.replace(/^[-*•]\s+/, "")) };
        }
        return { type: "paragraph", text: lines.join(" ") };
      })
      .filter((block): block is MessageBlock => Boolean(block));
  };

  const renderBoldText = (text: string) => {
    const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return segments.map((segment, idx) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold">
            {segment.slice(2, -2)}
          </strong>
        );
      }
      return <span key={idx}>{segment}</span>;
    });
  };

  const renderMessageContent = (content: string) => {
    const blocks = parseBlocks(content);
    if (!blocks.length) {
      return <p className="text-sm">{renderBoldText(content)}</p>;
    }
    return blocks.map((block, idx) => {
      if (block.type === "list") {
        return (
          <ul key={idx} className="list-disc pl-4 space-y-1 text-sm">
            {block.items.map((item, itemIdx) => (
              <li key={itemIdx} className="text-sm text-gray-800">
                {renderBoldText(item)}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={idx} className="text-sm text-gray-800 leading-relaxed">
          {renderBoldText(block.text)}
        </p>
      );
    });
  };

  const sanitizeAssistantReply = (reply: string): string => {
    const normalized = reply.replace(/\r\n?/g, "\n").trim();
    if (!normalized) {
      return "Need anything else about this recipe?";
    }
    const segments = normalized
      .split(/\n{2,}/)
      .map((segment) =>
        segment
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/^\s*[-*]\s+/gm, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    const stepRegex = /(\d+)\.\s*([^:]+):\s*([\s\S]*?)(?=\d+\.\s*[^:]+:|$)/g;
    const expandSegment = (segment: string): string[] => {
      const matches = Array.from(segment.matchAll(stepRegex));
      if (!matches.length) {
        return [segment];
      }
      const parts: string[] = [];
      const firstIndex = matches[0].index ?? 0;
      const prefix = segment.slice(0, firstIndex).trim();
      if (prefix) {
        parts.push(prefix.replace(/\s+/g, " "));
      }
      for (const match of matches) {
        const stepBody = match[3].trim();
        if (!stepBody) continue;
        parts.push(`Step ${match[1]} - ${match[2].trim()}: ${stepBody}`);
      }
      return parts;
    };

    const expandedSegments = segments.flatMap((segment) => expandSegment(segment));

    const seen = new Set<string>();
    const compact: string[] = [];
    for (const segment of expandedSegments) {
      const key = segment.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      compact.push(segment);
    }

    if (!compact.length) {
      return "Need anything else about this recipe?";
    }

    const formattedBlocks = compact.slice(0, 4).map((segment, index) => {
      const normalizeTitle = (text: string) => text.replace(/\s+/g, " ").trim();

      const stepFormatted = segment.match(/^Step\s+(\d+)\s*-\s*([^:]+):\s*(.*)$/i);
      if (stepFormatted) {
        const [, stepNumber, title, body] = stepFormatted;
        const cleanTitle = normalizeTitle(title);
        const cleanBody = body.trim();
        return cleanBody
          ? `**Step ${stepNumber} - ${cleanTitle}:** ${cleanBody}`
          : `**Step ${stepNumber} - ${cleanTitle}:**`;
      }

      const numberedMatch = segment.match(/^(\d+)\.\s*([^:]+):\s*(.*)$/);
      if (numberedMatch) {
        const [, stepNumber, title, body] = numberedMatch;
        const cleanTitle = normalizeTitle(title);
        const cleanBody = body.trim();
        return cleanBody
          ? `**Step ${stepNumber} - ${cleanTitle}:** ${cleanBody}`
          : `**Step ${stepNumber} - ${cleanTitle}:**`;
      }

      const titledMatch = segment.match(/^([^:]+):\s*(.*)$/);
      if (titledMatch) {
        const [, title, body] = titledMatch;
        const cleanTitle = normalizeTitle(title);
        const cleanBody = body.trim();
        return cleanBody ? `**${cleanTitle}:** ${cleanBody}` : `**${cleanTitle}:**`;
      }

      return `**Tip ${index + 1}:** ${segment}`;
    });

    return formattedBlocks.join("\n\n");
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    if (questionCount >= 3) {
      setError("Only three questions per recipe to keep it light. Start a new chat if you need more!");
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await askRecipeAssistant({
        recipe: payload,
        messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })),
      });
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: sanitizeAssistantReply(response.reply),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setQuestionCount((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to contact assistant", err);
      setError("Could not reach the AI sous-chef. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSend();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const suggestionLabels = ["Save time", "Swap an ingredient", "Add protein", "Make vegan"];

  const hasConversation = messages.some((message) => message.role === "user");
  const visibleMessages = hasConversation
    ? messages.filter((message) => message.id !== initialAssistantMessage.id)
    : [];

  const renderSuggestions = (alignment: "start" | "center" = "start") => (
    <div className={`flex flex-wrap gap-2 ${alignment === "center" ? "justify-center" : ""}`}>
      {suggestionLabels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => handleSuggestionClick(label)}
          className="px-3 py-1.5 rounded-2xl bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={questionCount >= 3}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-40 pointer-events-none">
          <button
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
            aria-label="Open recipe assistant"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        </div>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
            <div className="rounded-[28px] border border-gray-100 bg-white shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">ChefGPT</h3>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Beta</span>
                  </div>
                  <p className="text-xs text-gray-500">Powered by AI</p>
                </div>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
                {hasConversation ? (
                  <>
                    <div className="space-y-4">
                      {visibleMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.content === LIMIT_MESSAGE
                              ? "justify-center"
                              : message.role === "user"
                                ? "justify-end"
                                : "justify-start"
                          }`}
                        >
                          <div
                            className={
                              message.content === LIMIT_MESSAGE
                                ? "rounded-2xl px-4 py-3 shadow-sm max-w-[90%] bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-2 text-sm font-medium"
                                : `rounded-2xl px-4 py-3 shadow-sm max-w-[90%] space-y-2 ${
                                    message.role === "user"
                                      ? "bg-white text-gray-900 border border-gray-200 rounded-br-sm"
                                      : "bg-gray-50 text-gray-900 border border-gray-100 rounded-bl-sm"
                                  }`
                            }
                          >
                            {message.content === LIMIT_MESSAGE ? (
                              <>
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>You have reached your conversation limit.</span>
                              </>
                            ) : (
                              renderMessageContent(message.content)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {isSending && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        ChefGPT is thinking...
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900">Ask me anything about this recipe.</p>
                        <p className="text-sm text-gray-500 max-w-xs">
                          Quick tips, changes, or questions? I’ll help you make “{recipe.title}” perfect.
                        </p>
                      </div>
                    </div>
                    {renderSuggestions("center")}
                  </>
                )}
              </div>

              <div className="px-5 pt-3 pb-5 border-t border-gray-100 space-y-3">
                {hasConversation && renderSuggestions("start")}
                {error && <p className="text-xs text-red-500">{error}</p>}
                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                    disabled={questionCount >= 3}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !input.trim() || questionCount >= 3}
                    className="h-12 w-12 rounded-2xl bg-gradient-to-b from-violet-500 to-fuchsia-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
