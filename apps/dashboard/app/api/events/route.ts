import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const parseNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveOwnerIdsByEmail = async (emailQuery: string) => {
  const normalized = emailQuery.trim().toLowerCase();
  if (!normalized) return [];
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data?.users) return [];
  return data.users
    .filter((user) => user.email && user.email.toLowerCase().includes(normalized))
    .map((user) => user.id);
};

const normalizeDate = (value: string | null, fallback: "start" | "end") => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".");
    const iso = `${year}-${month}-${day}`;
    return fallback === "start"
      ? `${iso}T00:00:00.000Z`
      : `${iso}T23:59:59.999Z`;
  }
  if (trimmed.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return fallback === "start"
      ? `${trimmed}T00:00:00.000Z`
      : `${trimmed}T23:59:59.999Z`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    if (fallback === "start") {
      parsed.setUTCHours(0, 0, 0, 0);
    } else {
      parsed.setUTCHours(23, 59, 59, 999);
    }
    return parsed.toISOString();
  }
  return trimmed;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const eventType = searchParams.get("eventType");
  const source = searchParams.get("source");
  const model = searchParams.get("model");
  const usageContext = searchParams.get("usageContext");
  const start = normalizeDate(searchParams.get("start"), "start");
  const end = normalizeDate(searchParams.get("end"), "end");
  const minCredits = parseNumber(searchParams.get("minCredits"));
  const maxCredits = parseNumber(searchParams.get("maxCredits"));
  const limit = Math.min(parseNumber(searchParams.get("limit")) ?? 250, 1000);
  const offset = Math.max(parseNumber(searchParams.get("offset")) ?? 0, 0);

  let query = supabaseAdmin
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (email) {
    const ownerIds = await resolveOwnerIdsByEmail(email);
    if (ownerIds.length === 0) {
      return NextResponse.json({ events: [], hasMore: false, nextOffset: offset });
    }
    if (userId && !ownerIds.includes(userId)) {
      return NextResponse.json({ events: [], hasMore: false, nextOffset: offset });
    }
    query = query.in("owner_id", userId ? [userId] : ownerIds);
  } else if (userId) {
    query = query.eq("owner_id", userId);
  }
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

  const events = data ?? [];
  const ownerIds = Array.from(
    new Set(
      events
        .map((event) => event.owner_id)
        .filter((ownerId): ownerId is string => Boolean(ownerId))
    )
  );

  let emailByOwner = new Map<string, string>();
  if (ownerIds.length > 0) {
    const results = await Promise.all(
      ownerIds.map(async (ownerId) => {
        try {
          const { data: userData, error: userError } =
            await supabaseAdmin.auth.admin.getUserById(ownerId);
          if (userError || !userData?.user?.email) {
            return null;
          }
          return { ownerId, email: userData.user.email };
        } catch {
          return null;
        }
      })
    );
    emailByOwner = new Map(
      results.filter(Boolean).map((entry) => [entry!.ownerId, entry!.email])
    );
  }

  const hasMore = events.length === limit;
  const nextOffset = offset + events.length;
  return NextResponse.json({
    events: events.map((event) => ({
      ...event,
      user_email: emailByOwner.get(event.owner_id) ?? null,
    })),
    hasMore,
    nextOffset,
  });
}
