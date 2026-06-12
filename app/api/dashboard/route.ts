import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET /api/dashboard?account_id= — KPI + escalations + failed posts */
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

  const sb = getSupabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [scheduledToday, newConversations, convertedToday, escalations, failedPosts] = await Promise.all([
    sb.from("posts").select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .in("status", ["scheduled", "processing"])
      .gte("scheduled_at", todayStart.toISOString())
      .lt("scheduled_at", todayEnd.toISOString()),
    sb.from("contacts").select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .gte("first_seen", todayStart.toISOString()),
    sb.from("contacts").select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "converted"),
    sb.from("contacts").select("id, username, ig_user_id, escalation_reason, escalated_at, escalation_ack")
      .eq("account_id", accountId)
      .eq("escalated", true)
      .eq("escalation_ack", false)
      .order("escalated_at", { ascending: false })
      .limit(10),
    sb.from("posts").select("id, caption, media_url, scheduled_at, error_message")
      .eq("account_id", accountId)
      .eq("status", "failed")
      .order("scheduled_at", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    kpi: {
      scheduled_today: scheduledToday.count ?? 0,
      new_conversations_today: newConversations.count ?? 0,
      converted_total: convertedToday.count ?? 0,
    },
    escalations: escalations.data ?? [],
    failed_posts: failedPosts.data ?? [],
  });
}
