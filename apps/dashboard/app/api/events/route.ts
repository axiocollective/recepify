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

const resolveOwnerIdsByProfileFilters = async (
  userName: string | null,
  language: string | null,
  country: string | null
) => {
  let query = supabaseAdmin.from("profiles").select("id");
  if (userName) {
    query = query.ilike("name", `%${userName.trim()}%`);
  }
  if (language) {
    query = query.eq("language", language);
  }
  if (country) {
    query = query.eq("country", country);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => row.id);
};

const intersectIds = (a: string[] | null, b: string[] | null) => {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
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
  const userName = searchParams.get("userName");
  const language = searchParams.get("language");
  const country = searchParams.get("country");
  const eventType = searchParams.get("eventType");
  const source = searchParams.get("source");
  const model = searchParams.get("model");
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

  let ownerIds: string[] | null = null;
  if (email) {
    ownerIds = await resolveOwnerIdsByEmail(email);
  }
  if (userName || language || country) {
    const profileIds = await resolveOwnerIdsByProfileFilters(userName, language, country);
    ownerIds = intersectIds(ownerIds, profileIds);
  }
  if (ownerIds && ownerIds.length === 0) {
    return NextResponse.json({ events: [], hasMore: false, nextOffset: offset });
  }
  if (userId) {
    if (ownerIds && !ownerIds.includes(userId)) {
      return NextResponse.json({ events: [], hasMore: false, nextOffset: offset });
    }
    query = query.eq("owner_id", userId);
  } else if (ownerIds) {
    query = query.in("owner_id", ownerIds);
  }
  if (eventType) {
    if (eventType === "translation" || eventType === "translate") {
      query = query
        .eq("event_type", "ai_assistant")
        .filter("metadata->>usage_context", "eq", "translated_with_ai");
    } else if (eventType === "optimization" || eventType === "optimize") {
      query = query
        .eq("event_type", "ai_assistant")
        .filter("metadata->>usage_context", "eq", "optimized_with_ai");
    } else {
      query = query.eq("event_type", eventType);
    }
  }
  if (source) query = query.eq("source", source);
  if (model) query = query.eq("model_name", model);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lte("created_at", end);
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
