import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** GET /api/accounts — list accounts (no secrets) */
export async function GET() {
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("id, unit_name, ig_username, ig_user_id, token_expires_at, active, created_at")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const accounts = (data ?? []).map((a) => ({ ...a, has_token: false }));
  // has_token without exposing it
  const { data: tokens } = await getSupabase().from("accounts").select("id, access_token_encrypted");
  for (const t of tokens ?? []) {
    const acc = accounts.find((a) => a.id === t.id);
    if (acc) acc.has_token = Boolean(t.access_token_encrypted);
  }
  return NextResponse.json({ accounts });
}

/** POST /api/accounts — add account (unit_name, ig_username) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.unit_name || !body.ig_username) {
    return NextResponse.json({ error: "unit_name and ig_username required" }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from("accounts")
    .insert({ unit_name: body.unit_name, ig_username: body.ig_username.replace(/^@/, "") })
    .select("id, unit_name, ig_username, active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data }, { status: 201 });
}

/** PATCH /api/accounts — update account (token encrypted at rest) */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.unit_name !== undefined) update.unit_name = body.unit_name;
  if (body.ig_user_id !== undefined) update.ig_user_id = body.ig_user_id;
  if (body.token_expires_at !== undefined) update.token_expires_at = body.token_expires_at;
  if (body.active !== undefined) update.active = body.active;
  if (body.access_token) update.access_token_encrypted = encrypt(body.access_token);

  const { error } = await getSupabase().from("accounts").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
