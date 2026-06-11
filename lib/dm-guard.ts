/**
 * 24h messaging window guard (PRD §7-1).
 *
 * IG policy: a business may only reply within 24h of the user's last message.
 * Attempting to send outside the window counts as a violation — so we must
 * not even attempt the API call. Every DM send MUST pass through canSendDm.
 */

export const DM_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ContactWindow {
  /** Timestamp of the contact's last inbound message (ISO string or Date). */
  last_message_at: string | Date | null;
  /** Contact status — 'ai_off' means human takeover, AI must not send. */
  status?: string;
}

export function canSendDm(contact: ContactWindow, now: Date = new Date()): boolean {
  if (!contact.last_message_at) return false;
  if (contact.status === "ai_off") return false;

  const last = new Date(contact.last_message_at);
  if (isNaN(last.getTime())) return false;

  const elapsed = now.getTime() - last.getTime();
  return elapsed >= 0 && elapsed < DM_WINDOW_MS;
}
