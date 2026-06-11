import { getSupabase } from "./supabase";
import { encrypt, decrypt } from "./crypto";

/** Read a shared setting (decrypted). Falls back to env var if not in DB. */
export async function getSetting(key: string, envFallback?: string): Promise<string | null> {
  const { data } = await getSupabase().from("settings").select("value_encrypted").eq("key", key).maybeSingle();
  if (data?.value_encrypted) return decrypt(data.value_encrypted);
  if (envFallback && process.env[envFallback]) return process.env[envFallback]!;
  return null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await getSupabase().from("settings").upsert({
    key,
    value_encrypted: encrypt(value),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`setSetting failed: ${error.message}`);
}
