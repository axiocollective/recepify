import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const parseNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const eventType = searchParams.get("eventType");
  const source = searchParams.get("source");
  const model = searchParams.get("model");
  const usageContext = searchParams.get("usageContext");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const minCredits = parseNumber(searchParams.get("minCredits"));
  const maxCredits = parseNumber(searchParams.get("maxCredits"));
  const limit = Math.min(parseNumber(searchParams.get("limit")) ?? 250, 1000);

  let query = supabaseAdmin
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("owner_id", userId);
  if (eventType) query = query.eq("event_type", eventType);
  if (source) query = query.eq("source", source);
  if (model) query = query.eq("model_name", model);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lte("created_at", end);
  if (usageContext) query = query.filter("metadata->>usage_context", "eq", usageContext);
  if (minCredits !== null) query = query.gte("ai_credits_used", minCredits);
  if (maxCredits !== null) query = query.lte("ai_credits_used", maxCredits);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
