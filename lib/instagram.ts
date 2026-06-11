import { getSupabase } from "./supabase";
import { decrypt } from "./crypto";

/**
 * Instagram Graph API client (Instagram API with Instagram Login).
 * All calls are account-scoped: token is decrypted from accounts table.
 */

const GRAPH_BASE = process.env.IG_GRAPH_BASE ?? "https://graph.instagram.com/v23.0";

export interface IgAccount {
  id: string;
  ig_user_id: string;
  access_token: string;
}

export async function getIgAccount(accountId: string): Promise<IgAccount> {
  const { data, error } = await getSupabase()
    .from("accounts")
    .select("id, ig_user_id, access_token_encrypted")
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Error(`Account not found: ${accountId}`);
  if (!data.ig_user_id || !data.access_token_encrypted) {
    throw new Error(`Account ${accountId} missing ig_user_id or access token (set in Settings)`);
  }
  return {
    id: data.id,
    ig_user_id: data.ig_user_id,
    access_token: decrypt(data.access_token_encrypted),
  };
}

async function igFetch(
  path: string,
  token: string,
  options: { method?: string; params?: Record<string, string>; body?: Record<string, unknown> } = {}
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(options.params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string; code?: number } | undefined;
    throw new Error(`IG API ${res.status}: ${err?.message ?? JSON.stringify(json)}`);
  }
  return json;
}

// ── Publishing (Phase 1) ──────────────────────────────────

export async function createMediaContainer(
  acc: IgAccount,
  media: { media_url: string; media_type: string; caption: string }
): Promise<string> {
  const params: Record<string, string> = { caption: media.caption };
  if (media.media_type === "image") {
    params.image_url = media.media_url;
  } else {
    // video & reels publish as REELS (feed video deprecated in Graph API)
    params.video_url = media.media_url;
    params.media_type = "REELS";
  }
  const json = await igFetch(`${acc.ig_user_id}/media`, acc.access_token, {
    method: "POST",
    params,
  });
  return String(json.id);
}

export async function getContainerStatus(acc: IgAccount, containerId: string): Promise<string> {
  const json = await igFetch(containerId, acc.access_token, {
    params: { fields: "status_code" },
  });
  return String(json.status_code);
}

export async function publishMedia(acc: IgAccount, containerId: string): Promise<string> {
  const json = await igFetch(`${acc.ig_user_id}/media_publish`, acc.access_token, {
    method: "POST",
    params: { creation_id: containerId },
  });
  return String(json.id); // ig_media_id
}

// ── Messaging (Phase 2-3) ─────────────────────────────────

/** Send a DM to a user. Caller MUST have passed canSendDm() first. */
export async function sendDm(acc: IgAccount, recipientIgUserId: string, text: string): Promise<void> {
  await igFetch(`${acc.ig_user_id}/messages`, acc.access_token, {
    method: "POST",
    body: {
      recipient: { id: recipientIgUserId },
      message: { text },
    },
  });
}

/** Private reply to a comment — opens the DM thread from a comment (no 24h window needed). */
export async function sendPrivateReply(acc: IgAccount, commentId: string, text: string): Promise<void> {
  await igFetch(`${acc.ig_user_id}/messages`, acc.access_token, {
    method: "POST",
    body: {
      recipient: { comment_id: commentId },
      message: { text },
    },
  });
}

/** Public reply under a comment. */
export async function replyToComment(acc: IgAccount, commentId: string, text: string): Promise<void> {
  await igFetch(`${commentId}/replies`, acc.access_token, {
    method: "POST",
    params: { message: text },
  });
}
