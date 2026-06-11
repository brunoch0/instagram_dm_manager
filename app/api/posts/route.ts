import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MEDIA_BUCKET = "media";

async function ensureBucket() {
  const sb = getSupabase();
  const { data } = await sb.storage.getBucket(MEDIA_BUCKET);
  if (!data) {
    await sb.storage.createBucket(MEDIA_BUCKET, { public: true });
  }
}

/**
 * POST /api/posts — create a scheduled post.
 * multipart/form-data: file (optional), media_url (optional), media_type,
 * caption, cta_keyword, funnel_id, scheduled_at (ISO), account_id
 */
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  const form = await req.formData();

  const accountId = form.get("account_id") as string | null;
  const caption = (form.get("caption") as string | null) ?? "";
  const mediaType = (form.get("media_type") as string | null) ?? "image";
  const ctaKeyword = form.get("cta_keyword") as string | null;
  const funnelId = form.get("funnel_id") as string | null;
  const scheduledAt = form.get("scheduled_at") as string | null;
  const file = form.get("file") as File | null;
  let mediaUrl = form.get("media_url") as string | null;

  if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });
  if (!file && !mediaUrl) return NextResponse.json({ error: "file or media_url required" }, { status: 400 });

  if (file) {
    await ensureBucket();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${accountId}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from(MEDIA_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (upErr) return NextResponse.json({ error: `upload failed: ${upErr.message}` }, { status: 500 });
    mediaUrl = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await sb
    .from("posts")
    .insert({
      account_id: accountId,
      media_url: mediaUrl,
      media_type: mediaType,
      caption,
      cta_keyword: ctaKeyword,
      funnel_id: funnelId || null,
      scheduled_at: scheduledAt,
      status: scheduledAt ? "scheduled" : "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data }, { status: 201 });
}

/** GET /api/posts?account_id=... — list posts (newest first) */
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  let query = getSupabase().from("posts").select("*").order("created_at", { ascending: false }).limit(100);
  if (accountId) query = query.eq("account_id", accountId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}
