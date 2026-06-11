import { describe, it, expect } from "vitest";
import { canSendDm, DM_WINDOW_MS } from "../lib/dm-guard";

const NOW = new Date("2026-06-11T12:00:00Z");

describe("canSendDm (24h window guard)", () => {
  it("allows sending right after an inbound message", () => {
    expect(canSendDm({ last_message_at: NOW.toISOString() }, NOW)).toBe(true);
  });

  it("allows sending 23h59m after last message", () => {
    const last = new Date(NOW.getTime() - (DM_WINDOW_MS - 60_000));
    expect(canSendDm({ last_message_at: last.toISOString() }, NOW)).toBe(true);
  });

  it("blocks sending exactly at 24h", () => {
    const last = new Date(NOW.getTime() - DM_WINDOW_MS);
    expect(canSendDm({ last_message_at: last.toISOString() }, NOW)).toBe(false);
  });

  it("blocks sending after 24h", () => {
    const last = new Date(NOW.getTime() - DM_WINDOW_MS - 1000);
    expect(canSendDm({ last_message_at: last.toISOString() }, NOW)).toBe(false);
  });

  it("blocks when contact never messaged us", () => {
    expect(canSendDm({ last_message_at: null }, NOW)).toBe(false);
  });

  it("blocks when human takeover is active (ai_off)", () => {
    expect(
      canSendDm({ last_message_at: NOW.toISOString(), status: "ai_off" }, NOW)
    ).toBe(false);
  });

  it("blocks on invalid timestamp", () => {
    expect(canSendDm({ last_message_at: "not-a-date" }, NOW)).toBe(false);
  });

  it("blocks when last_message_at is in the future (clock skew safety)", () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(canSendDm({ last_message_at: future.toISOString() }, NOW)).toBe(false);
  });

  it("accepts Date objects as well as ISO strings", () => {
    expect(canSendDm({ last_message_at: NOW }, NOW)).toBe(true);
  });
});
