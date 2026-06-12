import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET /api/funnels?account_id=&days=30 — funnels with conversion counts */
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
  if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

  const sb = getSupabase();
  const { data: funnels, error } = await sb
    .from("funnels")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data: converted } = await sb
    .from("contacts")
    .select("current_funnel")
    .eq("account_id", accountId)
    .eq("status", "converted")
    .gte("last_message_at", since);

  const counts: Record<string, number> = {};
  for (const c of converted ?? []) {
    if (c.current_funnel) counts[c.current_funnel] = (counts[c.current_funnel] ?? 0) + 1;
  }

  return NextResponse.json({
    funnels: (funnels ?? []).map((f) => ({ ...f, conversions: counts[f.id] ?? 0 })),
  });
}

/** POST /api/funnels — create */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.account_id || !body.name) {
    return NextResponse.json({ error: "account_id and name required" }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from("funnels")
    .insert({
      account_id: body.account_id,
      name: body.name,
      goal: body.goal ?? null,
      destination_url: body.destination_url || null,
      trigger_keywords: body.trigger_keywords ?? [],
      languages: body.languages ?? [],
      system_prompt: body.system_prompt ?? null,
      active: body.active ?? true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ funnel: data }, { status: 201 });
}

/** PATCH /api/funnels — update */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { id, conversions: _ignore, ...update } = body;
  const { error } = await getSupabase().from("funnels").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
