/**
 * Password-gate auth. The cookie value is an HMAC of a fixed message keyed
 * by DASHBOARD_PASSWORD — verifiable in both the proxy and API routes
 * via Web Crypto, with no session storage.
 */

export const AUTH_COOKIE = "console_auth";
const HMAC_MESSAGE = "ig-dm-manager-v1";

export async function expectedToken(): Promise<string> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) throw new Error("DASHBOARD_PASSWORD env var is not set");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(HMAC_MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
