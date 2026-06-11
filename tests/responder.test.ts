import { describe, it, expect } from "vitest";
import { validateAiResponse, MAX_REPLY_LENGTH, AiResponse, FunnelInfo } from "../lib/responder";

const funnels: FunnelInfo[] = [
  { id: "1", name: "Creator", goal: "apply", destination_url: "https://k-ugc-match.lovable.app", languages: ["en"], system_prompt: null },
  { id: "2", name: "Guide", goal: "send guide", destination_url: null, languages: ["en", "ar"], system_prompt: null },
];

const base: AiResponse = {
  selected_funnel: "Creator",
  reply: "Apply here!",
  language: "en",
  should_send_link: true,
  link: "https://k-ugc-match.lovable.app",
  escalate: false,
  conversation_status: "active",
};

describe("validateAiResponse (PRD §7-3 constraints)", () => {
  it("passes a valid response through", () => {
    const v = validateAiResponse(base, funnels);
    expect(v.link).toBe("https://k-ugc-match.lovable.app");
    expect(v.should_send_link).toBe(true);
  });

  it("truncates replies over 300 chars", () => {
    const v = validateAiResponse({ ...base, reply: "한".repeat(400) }, funnels);
    expect(v.reply.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
  });

  it("blocks links not registered in any funnel", () => {
    const v = validateAiResponse({ ...base, link: "https://evil.example.com" }, funnels);
    expect(v.link).toBeNull();
    expect(v.should_send_link).toBe(false);
  });

  it("blocks send_link when funnel has no destination", () => {
    const v = validateAiResponse({ ...base, selected_funnel: "Guide", link: null }, funnels);
    expect(v.should_send_link).toBe(false);
  });
});
