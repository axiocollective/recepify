import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_UPLOAD_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif"]);

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

const DEFAULT_TEMPLATE: TemplateRecipe = {
  title: "",
  description: null,
  servings: null,
  prep_time: null,
  cook_time: null,
  total_time: null,
  ingredients: [],
  steps: [],
  notes: [],
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const normalizeTemplateIngredient = (entry: unknown): TemplateIngredient | null => {
  if (!isRecord(entry)) {
    return null;
  }
  const amountRaw = "amount" in entry ? entry.amount : null;
  const itemRaw = "item" in entry ? entry.item : null;
  const item = typeof itemRaw === "string" ? itemRaw.trim() : String(itemRaw ?? "").trim();
  if (!item) {
    return null;
  }
  const amount =
    typeof amountRaw === "string" ? amountRaw.trim() : amountRaw != null ? String(amountRaw).trim() : "";
  return {
    item,
    amount: amount || null,
  };
};

const normalizeTextEntry = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
};

function normalizeExtension(filename?: string | null): string | null {
  if (!filename) return null;
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return null;
  return filename.slice(idx).toLowerCase();
}

function ensureEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured on the server.`);
  }
  return value;
}

async function callGoogleVision(base64Content: string, apiKey: string): Promise<string> {
  const payload = {
    requests: [
      {
        image: { content: base64Content },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  };

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Vision request failed: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  return data?.responses?.[0]?.fullTextAnnotation?.text?.trim() ?? "";
}

function parseTemplateJson(raw: string | undefined): TemplateRecipe | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const merged: TemplateRecipe = {
      ...DEFAULT_TEMPLATE,
      ...parsed,
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients
            .map((entry: unknown) => normalizeTemplateIngredient(entry))
            .filter(
              (ingredient: TemplateIngredient | null): ingredient is TemplateIngredient => Boolean(ingredient)
            )
        : [],
      steps: Array.isArray(parsed.steps)
        ? parsed.steps
            .map((step: unknown) => normalizeTextEntry(step))
            .filter((step: string | null): step is string => Boolean(step))
        : [],
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
            .map((note: unknown) => normalizeTextEntry(note))
            .filter((note: string | null): note is string => Boolean(note))
        : [],
    };
    merged.title = merged.title?.trim() ?? "";
    merged.description = merged.description?.trim() || null;
    merged.servings = merged.servings?.trim() || null;
    merged.prep_time = merged.prep_time?.trim() || null;
    merged.cook_time = merged.cook_time?.trim() || null;
    merged.total_time = merged.total_time?.trim() || null;
    return merged;
  } catch {
    return null;
  }
}

async function buildTemplate(rawText: string, openAiKey: string): Promise<TemplateRecipe | null> {
  if (!rawText.trim()) {
    return null;
  }

  const client = new OpenAI({ apiKey: openAiKey });
  const prompt =
    "You are an expert culinary editor. Convert the provided OCR text into a structured recipe JSON object. " +
    "Populate missing fields with null and keep ingredient wording faithful to the source. Always respond with JSON.\n" +
    "Return JSON using this shape:\n" +
    JSON.stringify(DEFAULT_TEMPLATE, null, 2) +
    `\nOCR TEXT:\n"""${rawText}"""`;

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    max_output_tokens: 800,
  });

  const textBlocks: string[] = [];
  const outputBlocks = Array.isArray(response.output) ? response.output : [];
  for (const block of outputBlocks) {
    const contentItems = isRecord(block) && Array.isArray(block.content) ? block.content : [];
    for (const item of contentItems) {
      if (!isRecord(item)) {
        continue;
      }
      if (item.type === "output_text" && typeof item.text === "string") {
        textBlocks.push(item.text);
        continue;
      }
      if (typeof item.text === "string") {
        textBlocks.push(item.text);
        continue;
      }
      const nestedText = item.text;
      if (isRecord(nestedText) && typeof nestedText.value === "string") {
        textBlocks.push(nestedText.value);
      }
    }
  }
  const combined = textBlocks.join("\n").trim();
  return parseTemplateJson(extractFirstJson(combined));
}

function extractFirstJson(source: string): string | undefined {
  if (!source) return undefined;
  const match = source.match(/\{[\s\S]*\}/);
  return match?.[0];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let visionKey: string;
  let openaiKey: string | null = null;
  try {
    visionKey = ensureEnv("GOOGLE_VISION_API_KEY");
    try {
      openaiKey = ensureEnv("OPENAI_API_KEY");
    } catch {
      openaiKey = null;
    }
  } catch (envError) {
    return NextResponse.json({ error: String(envError) }, { status: 500 });
  }

  const formData = await request.formData();
  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "No image uploaded. Please attach a JPG, PNG, or HEIC file." }, { status: 400 });
  }

  if (fileEntry.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }

  if (fileEntry.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "File is too large. Maximum upload size is 8MB." }, { status: 400 });
  }

  const mimeType = fileEntry.type?.toLowerCase();
  const extension = normalizeExtension(fileEntry.name);
  const mimeAllowed = mimeType ? ALLOWED_MIME_TYPES.has(mimeType) : false;
  const extAllowed = extension ? ALLOWED_EXTENSIONS.has(extension) : false;

  if (!mimeAllowed && !extAllowed) {
    return NextResponse.json(
      { error: "Unsupported file type. Only JPG, PNG, or HEIC images are allowed." },
      { status: 400 }
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const base64Content = imageBuffer.toString("base64");

  try {
    const rawText = await callGoogleVision(base64Content, visionKey);
    let template: TemplateRecipe | null = null;
    let templateError: string | null = null;
    if (openaiKey) {
      try {
        template = await buildTemplate(rawText, openaiKey);
      } catch (templateErr) {
        templateError =
          templateErr instanceof Error ? templateErr.message : "Unable to format recipe with OpenAI at this time.";
      }
    } else {
      templateError = "OPENAI_API_KEY is missing. Only raw text will be returned.";
    }

    return NextResponse.json({
      raw_text: rawText,
      recipe: template,
      template_error: templateError,
    });
  } catch (scanError) {
    return NextResponse.json(
      {
        error: scanError instanceof Error ? scanError.message : "Unable to scan image at this time.",
      },
      { status: 502 }
    );
  }
}
