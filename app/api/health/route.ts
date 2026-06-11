import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {
    app: "ok",
    db: "not_configured",
  };

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await getSupabase().from("accounts").select("id").limit(1);
      checks.db = error ? `error: ${error.message}` : "ok";
    } catch (e) {
      checks.db = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  const healthy = checks.db === "ok";
  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
