export interface FunnelKeywords {
  id: string;
  name: string;
  trigger_keywords: string[];
}

/**
 * Match a comment/DM text against funnel trigger keywords.
 * Case-insensitive, whole-text substring match (keywords can be Arabic/Korean/English).
 * Returns the first matching funnel, or null.
 */
export function matchFunnelByKeyword<T extends FunnelKeywords>(funnels: T[], text: string): T | null {
  if (!text) return null;
  const normalized = text.toLowerCase();
  for (const funnel of funnels) {
    for (const keyword of funnel.trigger_keywords ?? []) {
      if (keyword && normalized.includes(keyword.toLowerCase())) {
        return funnel;
      }
    }
  }
  return null;
}
