import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { encrypt, decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const KNOWN_KEYS = [
  "meta_app_id",
  "meta_app_secret",
  "ig_webhook_verify_token",
  "anthropic_api_key",
  "beehiiv_publication_id",
  "beehiiv_api_key",
  "telegram_bot_token",
  "telegram_chat_id",
];

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

/** GET /api/settings — known keys with masked values (never full secrets) */
export async function GET() {
  const { data, error } = await getSupabase().from("settings").select("key, value_encrypted, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stored = new Map((data ?? []).map((r) => [r.key, r]));
  const settings = KNOWN_KEYS.map((key) => {
    const row = stored.get(key);
    let masked: string | null = null;
    if (row?.value_encrypted) {
      try {
        masked = mask(decrypt(row.value_encrypted));
      } catch {
        masked = "(decrypt error)";
      }
    }
    return { key, set: Boolean(row?.value_encrypted), masked, updated_at: row?.updated_at ?? null };
  });
  return NextResponse.json({ settings });
}

/** POST /api/settings — save keys { values: { key: plaintext } } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const values = body.values as Record<string, string> | undefined;
  if (!values) return NextResponse.json({ error: "values required" }, { status: 400 });

  const sb = getSupabase();
  for (const [key, value] of Object.entries(values)) {
    if (!KNOWN_KEYS.includes(key) || !value) continue;
    const { error } = await sb.from("settings").upsert({
      key,
      value_encrypted: encrypt(value),
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
