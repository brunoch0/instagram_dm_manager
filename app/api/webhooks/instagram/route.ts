import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getIgAccount, sendDm, sendPrivateReply, replyToComment } from "@/lib/instagram";
import { matchFunnelByKeyword } from "@/lib/keyword";
import { generateAiResponse, FunnelInfo } from "@/lib/responder";
import { canSendDm } from "@/lib/dm-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Webhook verification (Meta App setup) */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === process.env.IG_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

/** Webhook events: comments + messages */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.object !== "instagram") {
    return NextResponse.json({ ignored: true });
  }

  // Process entries; always return 200 fast so Meta doesn't retry-storm
  for (const entry of body.entry ?? []) {
    try {
      const igUserId = String(entry.id);

      // DM events
      for (const messaging of entry.messaging ?? []) {
        if (messaging.message?.is_echo) continue; // our own outbound messages
        const senderId = String(messaging.sender?.id ?? "");
        const text = messaging.message?.text ?? "";
        if (!senderId || senderId === igUserId) continue;
        await handleIncomingDm(igUserId, senderId, text);
      }

      // Comment events
      for (const change of entry.changes ?? []) {
        if (change.field !== "comments") continue;
        const value = change.value ?? {};
        const commenterId = String(value.from?.id ?? "");
        if (!commenterId || commenterId === igUserId) continue; // skip own comments
        await handleIncomingComment(igUserId, {
          comment_id: String(value.id),
          commenter_id: commenterId,
          commenter_username: value.from?.username ?? null,
          text: value.text ?? "",
        });
      }
    } catch (e) {
      console.error("webhook entry error:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ──────────────────────────────────────────────

async function findAccountByIgUserId(igUserId: string) {
  const { data } = await getSupabase()
    .from("accounts")
    .select("id")
    .eq("ig_user_id", igUserId)
    .eq("active", true)
    .maybeSingle();
  return data;
}

async function getActiveFunnels(accountId: string): Promise<(FunnelInfo & { trigger_keywords: string[] })[]> {
  const { data } = await getSupabase()
    .from("funnels")
    .select("id, name, goal, destination_url, trigger_keywords, languages, system_prompt")
    .eq("account_id", accountId)
    .eq("active", true);
  return data ?? [];
}

async function upsertContact(accountId: string, igUserId: string, username: string | null) {
  const sb = getSupabase();
  const { data: existing } = await sb
    .from("contacts")
    .select("*")
    .eq("account_id", accountId)
    .eq("ig_user_id", igUserId)
    .maybeSingle();

  if (existing) {
    await sb.from("contacts").update({
      last_message_at: new Date().toISOString(),
      ...(username ? { username } : {}),
    }).eq("id", existing.id);
    return { ...existing, last_message_at: new Date().toISOString() };
  }

  const { data: created } = await sb
    .from("contacts")
    .insert({
      account_id: accountId,
      ig_user_id: igUserId,
      username,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  return created;
}

async function saveMessage(contactId: string, direction: "in" | "out", text: string, funnelId?: string | null) {
  await getSupabase().from("messages").insert({
    contact_id: contactId,
    direction,
    text,
    funnel_id: funnelId ?? null,
  });
}

/** Comment with CTA keyword → public reply + private reply DM (Phase 2) */
async function handleIncomingComment(
  igUserId: string,
  comment: { comment_id: string; commenter_id: string; commenter_username: string | null; text: string }
) {
  const account = await findAccountByIgUserId(igUserId);
  if (!account) return;

  const funnels = await getActiveFunnels(account.id);
  const matched = matchFunnelByKeyword(funnels, comment.text);
  if (!matched) return; // no keyword → ignore comments (DMs handle free text)

  const acc = await getIgAccount(account.id);
  const contact = await upsertContact(account.id, comment.commenter_id, comment.commenter_username);

  // Private reply opens the DM thread directly from the comment
  const dmText = matched.destination_url
    ? `Thanks for your interest! 🙌 Here you go: ${matched.destination_url}`
    : `Thanks for your interest! 🙌 Tell me a bit more about what you're looking for.`;

  await sendPrivateReply(acc, comment.comment_id, dmText);
  await saveMessage(contact.id, "out", dmText, matched.id);
  await getSupabase().from("contacts").update({ current_funnel: matched.id }).eq("id", contact.id);

  // Public reply so others see engagement
  try {
    await replyToComment(acc, comment.comment_id, "DM sent! 📩 Check your inbox");
  } catch (e) {
    console.error("public reply failed:", e instanceof Error ? e.message : e);
  }
}

/** Incoming DM → AI Responder (Phase 3) */
async function handleIncomingDm(igUserId: string, senderId: string, text: string) {
  const sb = getSupabase();
  const account = await findAccountByIgUserId(igUserId);
  if (!account) return;

  const contact = await upsertContact(account.id, senderId, null);
  await saveMessage(contact.id, "in", text);

  // Human takeover — AI stays silent
  if (contact.status === "ai_off") return;

  const funnels = await getActiveFunnels(account.id);
  if (funnels.length === 0) return;

  const { data: history } = await sb
    .from("messages")
    .select("direction, text")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const ai = await generateAiResponse(
    funnels,
    (history ?? []).reverse().slice(0, -1) as { direction: "in" | "out"; text: string }[],
    text
  );

  // 24h guard — we just received a message so window is open, but always check (PRD §7-1)
  if (!canSendDm(contact)) {
    console.error(`24h guard blocked DM to contact ${contact.id}`);
    return;
  }

  const acc = await getIgAccount(account.id);
  const replyText = ai.should_send_link && ai.link ? `${ai.reply}\n${ai.link}` : ai.reply;
  await sendDm(acc, senderId, replyText);

  const selectedFunnel = funnels.find((f) => f.name === ai.selected_funnel);
  await saveMessage(contact.id, "out", replyText, selectedFunnel?.id ?? null);

  await sb.from("contacts").update({
    language: ai.language,
    current_funnel: selectedFunnel?.id ?? contact.current_funnel,
    status: ai.conversation_status === "active" ? contact.status : ai.conversation_status,
  }).eq("id", contact.id);

  if (ai.escalate) {
    // Surfaced in Console Dashboard/Inbox; Phase 6 adds Telegram notification
    await sb.from("contacts").update({
      escalated: true,
      escalation_reason: ai.escalation_reason ?? "other",
      escalated_at: new Date().toISOString(),
      escalation_ack: false,
    }).eq("id", contact.id);
  }
}
