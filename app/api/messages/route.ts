import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { canSendDm } from "@/lib/dm-guard";
import { getIgAccount, sendDm } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** GET /api/messages?contact_id= — thread messages (oldest first) */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("contact_id");
  if (!contactId) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("messages")
    .select("*, funnels:funnel_id(name)")
    .eq("contact_id", contactId)
    .order("created_at")
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

/** POST /api/messages — manual DM send from Inbox (human reply). 24h guard enforced. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.contact_id || !body.text) {
    return NextResponse.json({ error: "contact_id and text required" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: contact } = await sb.from("contacts").select("*").eq("id", body.contact_id).single();
  if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 404 });

  // PRD §7-1: never even attempt outside the 24h window.
  // Manual sends are allowed during ai_off (that's the point of takeover) — check window only.
  if (!canSendDm({ last_message_at: contact.last_message_at })) {
    return NextResponse.json(
      { error: "24h window expired — sending is blocked by Instagram policy" },
      { status: 403 }
    );
  }

  const acc = await getIgAccount(contact.account_id);
  await sendDm(acc, contact.ig_user_id, body.text);

  const { data: msg } = await sb
    .from("messages")
    .insert({ contact_id: contact.id, direction: "out", text: body.text })
    .select()
    .single();

  return NextResponse.json({ message: msg }, { status: 201 });
}
