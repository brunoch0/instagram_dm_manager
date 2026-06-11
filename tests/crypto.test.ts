import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encrypt / decrypt (AES-256-GCM)", () => {
  it("round-trips a secret", async () => {
    const { encrypt, decrypt } = await import("../lib/crypto");
    const secret = "IGQVJWlongAccessToken123!@#한국어도지원";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("../lib/crypto");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext (auth tag)", async () => {
    const { encrypt, decrypt } = await import("../lib/crypto");
    const stored = encrypt("secret");
    const parts = stored.split(".");
    const data = Buffer.from(parts[2], "base64");
    data[0] ^= 0xff;
    parts[2] = data.toString("base64");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("rejects malformed stored values", async () => {
    const { decrypt } = await import("../lib/crypto");
    expect(() => decrypt("garbage")).toThrow();
  });
});
