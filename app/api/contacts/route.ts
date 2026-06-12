import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET /api/contacts?account_id=&status=&escalated=true — conversation list */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const accountId = p.get("account_id");
  if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

  let query = getSupabase()
    .from("contacts")
    .select("*, funnels:current_funnel(name)")
    .eq("account_id", accountId)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (p.get("status")) query = query.eq("status", p.get("status"));
  if (p.get("escalated") === "true") query = query.eq("escalated", true).eq("escalation_ack", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // last message preview
  const contacts = data ?? [];
  const ids = contacts.map((c) => c.id);
  const previews: Record<string, string> = {};
  if (ids.length) {
    const { data: msgs } = await getSupabase()
      .from("messages")
      .select("contact_id, text, created_at")
      .in("contact_id", ids)
      .order("created_at", { ascending: false })
      .limit(300);
    for (const m of msgs ?? []) {
      if (!(m.contact_id in previews)) previews[m.contact_id] = m.text ?? "";
    }
  }

  return NextResponse.json({
    contacts: contacts.map((c) => ({ ...c, last_message_preview: previews[c.id] ?? "" })),
  });
}

/** PATCH /api/contacts — AI OFF toggle, escalation ack, status change */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.ai_off !== undefined) update.status = body.ai_off ? "ai_off" : "active";
  if (body.status !== undefined) update.status = body.status;
  if (body.escalation_ack !== undefined) update.escalation_ack = body.escalation_ack;

  const { error } = await getSupabase().from("contacts").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
