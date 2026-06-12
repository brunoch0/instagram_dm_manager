import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** PATCH /api/posts/:id — edit / reschedule (failed → scheduled) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  for (const key of ["caption", "cta_keyword", "funnel_id", "media_url", "media_type"]) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (body.scheduled_at !== undefined) {
    update.scheduled_at = body.scheduled_at;
    update.status = "scheduled";
    update.error_message = null;
    update.ig_container_id = null;
  }
  if (body.status !== undefined) update.status = body.status;

  const { data, error } = await getSupabase().from("posts").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

/** DELETE /api/posts/:id — only drafts/scheduled/failed (published stays) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await getSupabase()
    .from("posts")
    .delete()
    .eq("id", id)
    .in("status", ["draft", "scheduled", "failed"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
