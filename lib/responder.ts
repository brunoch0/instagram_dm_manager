import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "./settings";

/**
 * AI Responder (PRD §3-③): Claude analyzes intent, picks a funnel,
 * replies in the user's language, and guides toward the funnel destination
 * within 2-3 turns.
 */

// Bruno's stack prefers Sonnet; claude-sonnet-4-20250514 is retired 2026-06-15 → 4-6
const MODEL = process.env.RESPONDER_MODEL ?? "claude-sonnet-4-6";
export const MAX_REPLY_LENGTH = 300;

export interface FunnelInfo {
  id: string;
  name: string;
  goal: string | null;
  destination_url: string | null;
  languages: string[];
  system_prompt: string | null;
}

export interface ConversationMessage {
  direction: "in" | "out";
  text: string;
}

export interface AiResponse {
  selected_funnel: string;
  reply: string;
  language: string;
  should_send_link: boolean;
  link: string | null;
  escalate: boolean;
  escalation_reason: "b2b" | "complaint" | "policy" | "other" | null;
  conversation_status: "active" | "converted" | "ended";
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    selected_funnel: { type: "string", description: "funnel name, or 'none'" },
    reply: { type: "string", description: `Reply text in the user's language, max ${MAX_REPLY_LENGTH} chars` },
    language: { type: "string", enum: ["ar", "en", "ko"] },
    should_send_link: { type: "boolean" },
    link: { type: ["string", "null"] },
    escalate: { type: "boolean", description: "true for B2B inquiries, complaints, or unclear judgment calls" },
    escalation_reason: {
      type: ["string", "null"],
      enum: ["b2b", "complaint", "policy", "other", null],
      description: "reason tag when escalate=true",
    },
    conversation_status: { type: "string", enum: ["active", "converted", "ended"] },
  },
  required: ["selected_funnel", "reply", "language", "should_send_link", "link", "escalate", "escalation_reason", "conversation_status"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(funnels: FunnelInfo[]): string {
  const funnelList = funnels
    .map(
      (f) =>
        `- ${f.name}: goal=${f.goal ?? "n/a"}, destination=${f.destination_url ?? "(not set)"}, languages=${f.languages.join("/")}${f.system_prompt ? `\n  guidance: ${f.system_prompt}` : ""}`
    )
    .join("\n");

  return `You are the Instagram DM assistant for this account. Analyze the user's intent and route them to the right funnel.

Available funnels:
${funnelList}

Rules:
1. Reply in the user's language (Arabic, English, or Korean).
2. Max ${MAX_REPLY_LENGTH} characters per reply. Friendly, concise, 1-2 sentences.
3. Guide toward the funnel destination within 2-3 turns. When intent is clear, set should_send_link=true with the funnel's destination URL.
4. NEVER promise prices, contracts, or business terms. For B2B/partnership inquiries, complaints, or anything you cannot judge: set escalate=true and reply that the team will follow up.
5. Only use links from the funnel list above. Never invent URLs.
6. If the user declines or says stop: politely end, conversation_status=ended.
7. If the user completed the goal (signed up / clicked / applied): conversation_status=converted.`;
}

/** Enforce hard constraints regardless of what the model returned (PRD §7-3). */
export function validateAiResponse(raw: AiResponse, funnels: FunnelInfo[]): AiResponse {
  const allowedLinks = new Set(funnels.map((f) => f.destination_url).filter(Boolean) as string[]);
  let reply = raw.reply ?? "";
  if (reply.length > MAX_REPLY_LENGTH) reply = reply.slice(0, MAX_REPLY_LENGTH - 1) + "…";

  let link = raw.link;
  let shouldSendLink = raw.should_send_link;
  if (!link || !allowedLinks.has(link)) {
    link = null;
    shouldSendLink = false;
  }

  return { ...raw, reply, link, should_send_link: shouldSendLink };
}

export async function generateAiResponse(
  funnels: FunnelInfo[],
  history: ConversationMessage[],
  incomingText: string
): Promise<AiResponse> {
  const apiKey = await getSetting("anthropic_api_key", "ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Anthropic API key not configured (Settings or ANTHROPIC_API_KEY)");

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10).map((m) => ({
      role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
      content: m.text || "(media)",
    })),
    { role: "user" as const, content: incomingText },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(funnels),
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Empty AI response");

  const parsed = JSON.parse(textBlock.text) as AiResponse;
  return validateAiResponse(parsed, funnels);
}
