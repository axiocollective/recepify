import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, plan, subscription_period, trial_ends_at, language, country")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = data ?? [];
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map(
    (authData?.users ?? []).map((user) => [user.id, user.email ?? null])
  );
  const users = profiles.map((profile) => ({
    ...profile,
    email: emailById.get(profile.id) ?? null,
  }));
  return NextResponse.json({ users });
}
