import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Recipe } from "../data/types";
import { askRecipeAssistant } from "../services/assistantApi";
import { colors, radius, spacing, shadow } from "../theme/theme";
import { useApp } from "../data/AppContext";
import { isAiLimitReached } from "../data/usageLimits";

interface RecipeAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: Recipe;
  recipes?: Recipe[];
}

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; isThinking?: boolean };

const createId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const MAX_USER_MESSAGES = 10;
const THINKING_MESSAGE = "ChefGPT is typing...";
const LIMIT_MESSAGE =
  "You hit the 10-question limit for this recipe. Start a new chat and we can keep cooking!";

const assistantSystemPrompt =
  "You are ChefGPT, an AI-powered sous-chef inside a recipe app.\n" +
  "You must ONLY answer questions that are directly related to the currently open recipe and the provided recipe data.\n" +
  "You have access to: recipe title, description, duration, servings, ingredients (with amounts), steps, and nutrition values.\n\n" +
  "Style:\n" +
  "- Short, concise, precise.\n" +
  "- Polite and lightly funny (no cringe, no sarcasm).\n" +
  "- Prefer 1-4 sentences. If needed, use a short bullet list (max 5 bullets).\n" +
  "- Use the recipe data explicitly when helpful (amounts, steps, timing, servings, nutrition).\n\n" +
  "Hard rules:\n" +
  "- Do NOT invent missing information. If data is not provided, say so briefly and suggest what the user can do next.\n" +
  "- Do NOT answer questions that are too far away from the recipe (e.g., politics, relationships, finance, coding, general trivia, medical diagnosis).\n" +
  "- If the question is out of scope, refuse politely and humorously, and suggest 2-3 recipe-related alternatives.\n" +
  "- If the user has already sent 10 messages in this conversation, do not answer new questions. Reply politely that the limit is reached and suggest starting a new chat.\n\n" +
  "You will receive the recipe data as JSON. Base your answer strictly on that JSON and the user’s question.";

const buildAssistantRecipePayload = (recipe: Recipe) => ({
  title: recipe.title || "Untitled Recipe",
  description: recipe.description ?? undefined,
  duration: recipe.totalTime ?? recipe.duration ?? undefined,
  servings: recipe.servings ? String(recipe.servings) : undefined,
  prep_time: recipe.prepTime ?? undefined,
  cook_time: recipe.cookTime ?? undefined,
  total_time: recipe.totalTime ?? undefined,
  difficulty: recipe.difficulty ?? undefined,
  meal_type: recipe.category ?? undefined,
  source: recipe.source,
  nutrition_calories: recipe.nutrition?.calories ? String(recipe.nutrition.calories) : undefined,
  nutrition_protein: recipe.nutrition?.protein ? String(recipe.nutrition.protein) : undefined,
  nutrition_carbs: recipe.nutrition?.carbs ? String(recipe.nutrition.carbs) : undefined,
  nutrition_fat: recipe.nutrition?.fat ? String(recipe.nutrition.fat) : undefined,
  tags: recipe.tags ?? [],
  notes: recipe.notes ?? undefined,
  ingredients: recipe.ingredients
    .map((ingredient) => [ingredient.amount, ingredient.name].filter(Boolean).join(" ").trim())
    .filter(Boolean),
  steps: recipe.steps.filter((step) => step.trim().length > 0),
});

const stripCodeFences = (value: string) => value.replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""));

const extractJsonObject = (value: string) => {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { sections?: Array<{ title?: string; content?: string[] | string }> };
  } catch {
    return null;
  }
};

const normalizeForDedup = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const isNutritionQuestion = (value: string) =>
  /(nutrition|nutrients|calorie|calories|protein|carb|carbs|fat|macro|nährwert|kalorie|kalorien|eiweiß|protein|kohlenhydrat|kohlenhydrate|fett)/i.test(
    value
  );

const isHealthQuestion = (value: string) =>
  /(healthy|healthier|unhealthy|gesund|gesundheit|gesundes|gesundheitlich)/i.test(value);

const buildNutritionReply = (recipe: Recipe, question: string) => {
  const nutrition = recipe.nutrition;
  if (!nutrition) return null;
  const hasAny = nutrition.calories || nutrition.protein || nutrition.carbs || nutrition.fat;
  if (!hasAny) return null;

  const isGerman = /(nährwert|kalorie|kalorien|eiweiß|kohlenhydrat|kohlenhydrate|fett|pro portion)/i.test(question);
  const lines: string[] = [];
  if (isGerman) {
    lines.push("Nährwerte pro Portion:");
    if (nutrition.calories) lines.push(`- Kalorien: ${nutrition.calories}`);
    if (nutrition.protein) lines.push(`- Protein: ${nutrition.protein}`);
    if (nutrition.carbs) lines.push(`- Kohlenhydrate: ${nutrition.carbs}`);
    if (nutrition.fat) lines.push(`- Fett: ${nutrition.fat}`);
    return lines.join("\n");
  }

  lines.push("Nutrition per serving:");
  if (nutrition.calories) lines.push(`- Calories: ${nutrition.calories}`);
  if (nutrition.protein) lines.push(`- Protein: ${nutrition.protein}`);
  if (nutrition.carbs) lines.push(`- Carbs: ${nutrition.carbs}`);
  if (nutrition.fat) lines.push(`- Fat: ${nutrition.fat}`);
  return lines.join("\n");
};

const buildHealthReply = (recipe: Recipe, question: string) => {
  const nutrition = recipe.nutrition;
  if (!nutrition) return null;
  const hasAny = nutrition.calories || nutrition.protein || nutrition.carbs || nutrition.fat;
  if (!hasAny) return null;

  const isGerman = /(gesund|gesundheit|pro portion)/i.test(question);
  const calories = nutrition.calories ? Number(nutrition.calories) : undefined;
  const protein = nutrition.protein ? String(nutrition.protein) : undefined;
  const carbs = nutrition.carbs ? String(nutrition.carbs) : undefined;
  const fat = nutrition.fat ? String(nutrition.fat) : undefined;

  if (isGerman) {
    const lines: string[] = ["Kurzer Gesundheits-Check anhand der Nährwerte pro Portion:"];
    if (calories) lines.push(`- Kalorien: ${calories}`);
    if (protein) lines.push(`- Protein: ${protein}`);
    if (carbs) lines.push(`- Kohlenhydrate: ${carbs}`);
    if (fat) lines.push(`- Fett: ${fat}`);
    lines.push("Ob es “gesund” ist, hängt auch von deinem Ziel ab. Sag mir gern, worauf du achtest.");
    return lines.join("\n");
  }

  const lines: string[] = ["Quick health check based on the nutrition per serving:"];
  if (calories) lines.push(`- Calories: ${calories}`);
  if (protein) lines.push(`- Protein: ${protein}`);
  if (carbs) lines.push(`- Carbs: ${carbs}`);
  if (fat) lines.push(`- Fat: ${fat}`);
  lines.push("Whether it’s “healthy” depends on your goals. Tell me what you’re optimizing for.");
  return lines.join("\n");
};

const forceBulletList = (text: string) => {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const numbered = normalized.match(/\b\d+\.\s+/g);
  if (numbered && numbered.length >= 2) {
    return normalized.replace(/\b\d+\.\s+/g, "\n- ").trim();
  }
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (!sentences.length) return normalized;
  return sentences.map((sentence) => `- ${sentence}`).join("\n");
};

const formatAssistantReply = (reply: string, options?: { forceBullets?: boolean }) => {
  const cleaned = stripCodeFences(reply).trim();
  if (!cleaned) {
    return "I can only help with this recipe. Try asking about substitutions, timing, or servings.";
  }
  try {
    const parsed = JSON.parse(cleaned) as { sections?: Array<{ title?: string; content?: string[] | string }> };
    if (parsed?.sections?.length) {
      return parsed.sections
        .slice(0, 3)
        .map((section) => {
          const title = (section.title ?? "Tip").trim();
          const content = Array.isArray(section.content)
            ? section.content
            : section.content
            ? [section.content]
            : [];
          const body = content
            .slice(0, 5)
            .map((line) => (line.startsWith("-") ? line : `- ${line}`))
            .join("\n");
          return `${title}\n${body}`;
        })
        .join("\n\n");
    }
  } catch {
    // fall through
  }
  const extracted = extractJsonObject(cleaned);
  if (extracted?.sections?.length) {
    return extracted.sections
      .slice(0, 3)
      .map((section) => {
        const title = (section.title ?? "Tip").trim();
        const content = Array.isArray(section.content)
          ? section.content
          : section.content
          ? [section.content]
          : [];
        const body = content
          .slice(0, 5)
          .map((line) => (line.startsWith("-") ? line : `- ${line}`))
          .join("\n");
        return `${title}\n${body}`;
      })
      .join("\n\n");
  }
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const paragraphSeen = new Set<string>();
  const dedupedParagraphs: string[] = [];
  for (const block of paragraphs) {
    const key = normalizeForDedup(block);
    if (!key || paragraphSeen.has(key)) continue;
    paragraphSeen.add(key);
    dedupedParagraphs.push(block);
  }

  const sentenceSeen = new Set<string>();
  const cleanedParagraphs = dedupedParagraphs.map((block) => {
    const parts = block.split(/(?<=[.!?])\s+/);
    const kept: string[] = [];
    for (const part of parts) {
      const key = normalizeForDedup(part);
      if (!key || sentenceSeen.has(key)) continue;
      sentenceSeen.add(key);
      kept.push(part.trim());
    }
    return kept.join(" ");
  });

  const joined = cleanedParagraphs.filter(Boolean).join("\n\n");
  if (options?.forceBullets) {
    return forceBulletList(joined);
  }
  return joined;
};

const normalizeAssistantText = (text: string) => {
  const numberedMatches = text.match(/\b\d+\.\s+/g) ?? [];
  const withBullets = text
    .replace(/:\s*-\s*/g, "\n- ")
    .replace(/([.!?])\s*-\s*/g, "$1\n- ")
    .replace(/\s+-\s+\*\*/g, "\n- **")
    .replace(/\s+-\s+/g, "\n- ");
  const withNumbers = numberedMatches.length >= 2 ? withBullets.replace(/\b\d+\.\s+/g, "\n- ") : withBullets;
  return withNumbers.replace(/\s{2,}/g, " ").trim();
};

const renderAssistantText = (text: string) => {
  const normalized = normalizeAssistantText(text);
  const lines = normalized.split("\n");
  const nodes: Array<React.ReactNode> = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const boldStart = trimmed.startsWith("**") ? trimmed : null;
    if (boldStart) {
      const match = trimmed.match(/^\*\*(.+?)\*\*(.*)$/);
      if (match) {
        const title = match[1].trim();
        const rest = match[2].trim();
        nodes.push(
          <Text key={`bold-${index}`} style={styles.boldText}>
            {title}
          </Text>
        );
        if (rest) {
          nodes.push("\n");
          nodes.push(rest.replace(/^[:\-–]\s*/, ""));
        }
      } else {
        nodes.push(line);
      }
    } else {
      const bulletMatch = line.match(/^(\s*[-*•]\s*)\*\*(.+?)\*\*(.*)$/);
        if (bulletMatch) {
        const [, , title, rest] = bulletMatch;
        nodes.push("• ");
        const cleanTitle = title.trim().replace(/:$/, "");
        nodes.push(
          <Text key={`bullet-${index}`} style={styles.boldText}>
            {cleanTitle}
          </Text>
        );
        if (rest.trim()) {
          nodes.push("\n");
          nodes.push(rest.replace(/^[:\-–]\s*/, "").trim());
        }
      } else if (/^\s*[-*•]\s+/.test(line)) {
        nodes.push("• ");
        nodes.push(line.replace(/^\s*[-*•]\s+/, "").trim());
      } else {
        const inlineBold = line.match(/^(.*)\*\*(.+?)\*\*(.*)$/);
        if (inlineBold) {
          const [, prefix, title, suffix] = inlineBold;
          if (prefix.trim()) {
            nodes.push(prefix.trim());
            nodes.push("\n");
          }
          const cleanTitle = title.trim().replace(/:$/, "");
          nodes.push(
            <Text key={`inline-${index}`} style={styles.boldText}>
              {cleanTitle}
            </Text>
          );
          if (suffix.trim()) {
            nodes.push("\n");
            nodes.push(suffix.replace(/^[:\-–]\s*/, "").trim());
          }
        } else {
          nodes.push(line);
        }
      }
    }
    if (index < lines.length - 1) {
      nodes.push("\n");
    }
  });
  return nodes;
};

export const RecipeAssistantChat: React.FC<RecipeAssistantChatProps> = ({ isOpen, onClose, recipe, recipes }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.75);
  const scrollRef = useRef<ScrollView | null>(null);
  const { plan, usageSummary, aiDisabled, refreshUsageSummary } = useApp();
  const aiLimitReached = isAiLimitReached(plan, usageSummary);
  const aiUsageBlocked = aiDisabled || aiLimitReached;
  const aiLimitMessage = aiDisabled
    ? "AI features are disabled on your plan. Upgrade to re-enable ChefGPT."
    : "You’ve used all monthly credits. Wait for the reset or upgrade your plan.";

  const suggestions = useMemo(
    () => [
      "Make it healthier?",
      "Any substitutions?",
      "Save time?",
    ],
    []
  );

  const activeRecipe = recipe ?? recipes?.[0];
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const limitReached = userMessageCount >= MAX_USER_MESSAGES;

  const resetConversation = () => {
    setMessages([]);
    setInput("");
    setError(null);
    setIsSending(false);
  };

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    resetConversation();
  }, [activeRecipe?.id]);

  const handleSend = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isSending) return;

    if (!activeRecipe) {
      setError("Please open a recipe first.");
      return;
    }

    if (aiUsageBlocked) {
      setMessages((prev) => [...prev, { id: createId(), role: "assistant", text: aiLimitMessage }]);
      return;
    }

    const isStepsQuestion = /(steps|schritte|anleitung|zubereitung|how\s+to\s+cook)/i.test(trimmed);
    const isNutritionAsk = isNutritionQuestion(trimmed);
    const isHealthAsk = isHealthQuestion(trimmed);

    if (limitReached) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.text === LIMIT_MESSAGE) {
          return prev;
        }
        return [...prev, { id: createId(), role: "assistant", text: LIMIT_MESSAGE }];
      });
      return;
    }

    const userMessage: ChatMessage = { id: createId(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    if (isNutritionAsk || isHealthAsk) {
      const nutritionReply = activeRecipe ? buildNutritionReply(activeRecipe, trimmed) : null;
      const healthReply = isHealthAsk && activeRecipe ? buildHealthReply(activeRecipe, trimmed) : null;
      const replyToSend = healthReply ?? nutritionReply;
      if (replyToSend) {
        setMessages((prev) => [
          ...prev,
          { id: createId(), role: "assistant", text: replyToSend },
        ]);
        setIsSending(false);
        return;
      }
    }

    const thinkingId = createId();
    setMessages((prev) => [...prev, { id: thinkingId, role: "assistant", text: THINKING_MESSAGE, isThinking: true }]);

    try {
      const history = [...messages, userMessage]
        .filter((message) => !message.isThinking)
        .map((message) => ({ role: message.role, content: message.text }));

      const response = await askRecipeAssistant({
        recipe: buildAssistantRecipePayload(activeRecipe),
        messages: [{ role: "assistant", content: assistantSystemPrompt }, ...history],
      });

      const reply = formatAssistantReply(response.reply ?? "", { forceBullets: isStepsQuestion });
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== thinkingId),
        { id: createId(), role: "assistant", text: reply },
      ]);
      refreshUsageSummary();
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message.id !== thinkingId));
      setError("ChefGPT is offline right now. Please try again in a moment.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.backdrop} />
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.sheet}>
        <View style={[styles.card, shadow.lg, { height: sheetHeight }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="sparkles" size={18} color={colors.white} />
              </View>
              <View>
                <Text style={styles.title}>ChefGPT</Text>
                <Text style={styles.subtitle}>Powered by AI</Text>
              </View>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={colors.gray500} />
            </Pressable>
          </View>
          <View style={styles.headerDivider} />

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.lg }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length ? (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    message.role === "user" ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  {message.role === "assistant" ? (
                    <Text style={[styles.bubbleText, styles.assistantText]}>
                      {renderAssistantText(message.text)}
                    </Text>
                  ) : (
                    <Text style={[styles.bubbleText, styles.userText]}>{message.text}</Text>
                  )}
                </View>
              ))
            ) : (
              <>
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="sparkles" size={22} color={colors.purple600} />
                  </View>
                  <Text style={styles.emptyIntro}>I am your AI powered sous chef.</Text>
                  <Text style={styles.emptyTitle}>How can I help you?</Text>
                  <Text style={styles.emptySubtitle}>
                    Ask me anything about Recipy "{activeRecipe?.title ?? "this recipe"}" - from tips to substitutions.
                  </Text>
                </View>
                <View style={styles.suggestionsCentered}>
                  {suggestions.map((label) => (
                    <Pressable
                      key={label}
                      style={styles.suggestionChip}
                      onPress={() => handleSend(label)}
                      disabled={limitReached}
                    >
                      <Text style={styles.suggestionText} numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.disclaimerText}>
              ChefGPT can make mistakes. Please double-check important details.
            </Text>
            {aiUsageBlocked && (
              <View style={styles.limitBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.purple600} />
                <Text style={styles.limitBannerText}>{aiLimitMessage}</Text>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type in your question..."
                placeholderTextColor={colors.gray500}
                style={styles.input}
                editable={!limitReached && !aiUsageBlocked}
              />
              <Pressable
                style={[styles.sendButton, (limitReached || aiUsageBlocked) && styles.sendButtonDisabled]}
                onPress={() => handleSend()}
                disabled={isSending || !input.trim() || limitReached || aiUsageBlocked}
              >
                <Ionicons name={isSending ? "sync" : "send"} size={18} color={colors.white} />
              </Pressable>
            </View>
            {limitReached && (
              <Pressable style={styles.resetButton} onPress={resetConversation}>
                <Text style={styles.resetButtonText}>Start new chat</Text>
              </Pressable>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  sheet: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.lg,
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.purple600,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  messages: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  bubble: {
    maxWidth: "90%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
  },
  assistantBubble: {
    backgroundColor: colors.purple600,
    borderWidth: 0,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 8,
  },
  userBubble: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignSelf: "flex-end",
    borderBottomRightRadius: 8,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray900,
  },
  boldText: {
    fontWeight: "700",
    color: colors.white,
  },
  assistantText: {
    color: colors.white,
  },
  userText: {
    color: colors.gray900,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple50,
  },
  emptyIntro: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.gray500,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    color: colors.gray900,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray500,
    textAlign: "center",
    maxWidth: 280,
  },
  suggestionsCentered: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  suggestionText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.gray700,
    maxWidth: 180,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray100,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.gray400,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray100,
    gap: spacing.md,
  },
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.purple100,
    backgroundColor: colors.purple100,
  },
  limitBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    backgroundColor: colors.gray50,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple600,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  resetButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray900,
  },
  resetButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.white,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.red500,
  },
});
