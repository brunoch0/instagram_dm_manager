import { describe, it, expect } from "vitest";
import { matchFunnelByKeyword } from "../lib/keyword";

const funnels = [
  { id: "1", name: "Guide", trigger_keywords: ["GUIDE", "رمضان"] },
  { id: "2", name: "Creator", trigger_keywords: ["CREATOR"] },
  { id: "3", name: "Brand B2B", trigger_keywords: ["KBEAUTY"] },
];

describe("matchFunnelByKeyword", () => {
  it("matches an English keyword case-insensitively", () => {
    expect(matchFunnelByKeyword(funnels, "please send me the guide!")?.name).toBe("Guide");
  });

  it("matches an Arabic keyword", () => {
    expect(matchFunnelByKeyword(funnels, "رمضان 🌙")?.name).toBe("Guide");
  });

  it("matches keyword embedded in longer text", () => {
    expect(matchFunnelByKeyword(funnels, "I am a CREATOR from Dubai")?.name).toBe("Creator");
  });

  it("returns null when nothing matches", () => {
    expect(matchFunnelByKeyword(funnels, "hello there")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(matchFunnelByKeyword(funnels, "")).toBeNull();
  });

  it("returns first funnel when multiple match", () => {
    expect(matchFunnelByKeyword(funnels, "GUIDE KBEAUTY")?.name).toBe("Guide");
  });
});
