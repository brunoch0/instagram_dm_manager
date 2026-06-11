import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getIgAccount, createMediaContainer, getContainerStatus, publishMedia } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Posts stuck in processing longer than this are marked failed. */
const PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * Vercel Cron (every minute):
 * 1. processing posts → check container status → publish when FINISHED
 * 2. scheduled posts due → create IG container (images publish same tick if ready)
 *
 * Two-phase structure avoids long polling inside one serverless invocation —
 * Reels containers can take minutes; the next cron tick picks them up.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  const now = new Date().toISOString();
  const results: Array<Record<string, string>> = [];

  // ── Phase A: finish processing posts ─────────────────────
  const { data: processing } = await sb
    .from("posts")
    .select("*")
    .eq("status", "processing")
    .limit(10);

  for (const post of processing ?? []) {
    try {
      const acc = await getIgAccount(post.account_id);
      const status = await getContainerStatus(acc, post.ig_container_id);

      if (status === "FINISHED") {
        const igMediaId = await publishMedia(acc, post.ig_container_id);
        await sb.from("posts").update({
          status: "published",
          ig_media_id: igMediaId,
          published_at: new Date().toISOString(),
        }).eq("id", post.id);
        results.push({ id: post.id, action: "published" });
      } else if (status === "ERROR" || status === "EXPIRED") {
        await sb.from("posts").update({
          status: "failed",
          error_message: `container status: ${status}`,
        }).eq("id", post.id);
        results.push({ id: post.id, action: "failed", reason: status });
      } else {
        // IN_PROGRESS — check timeout, otherwise wait for next tick
        const age = Date.now() - new Date(post.scheduled_at).getTime();
        if (age > PROCESSING_TIMEOUT_MS) {
          await sb.from("posts").update({
            status: "failed",
            error_message: "processing timeout (2h)",
          }).eq("id", post.id);
          results.push({ id: post.id, action: "failed", reason: "timeout" });
        } else {
          results.push({ id: post.id, action: "waiting", status });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await sb.from("posts").update({ status: "failed", error_message: msg }).eq("id", post.id);
      results.push({ id: post.id, action: "failed", reason: msg });
    }
  }

  // ── Phase B: start due scheduled posts ───────────────────
  const { data: due } = await sb
    .from("posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(5);

  for (const post of due ?? []) {
    try {
      const acc = await getIgAccount(post.account_id);
      const containerId = await createMediaContainer(acc, {
        media_url: post.media_url,
        media_type: post.media_type,
        caption: post.caption ?? "",
      });

      // Images are usually ready immediately — try same-tick publish
      if (post.media_type === "image") {
        const status = await getContainerStatus(acc, containerId);
        if (status === "FINISHED") {
          const igMediaId = await publishMedia(acc, containerId);
          await sb.from("posts").update({
            status: "published",
            ig_container_id: containerId,
            ig_media_id: igMediaId,
            published_at: new Date().toISOString(),
          }).eq("id", post.id);
          results.push({ id: post.id, action: "published" });
          continue;
        }
      }

      await sb.from("posts").update({
        status: "processing",
        ig_container_id: containerId,
      }).eq("id", post.id);
      results.push({ id: post.id, action: "container_created" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await sb.from("posts").update({ status: "failed", error_message: msg }).eq("id", post.id);
      results.push({ id: post.id, action: "failed", reason: msg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
