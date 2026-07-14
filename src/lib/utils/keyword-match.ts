/**
 * Keyword-alert matching (#147), shared by the activity scan route and any
 * client-side consumers. Case-insensitive substring semantics — the same
 * contract useSmartNotifications applies to the open conversation.
 */

/** Parse a comma-separated keyword pref into a lowercased, de-blanked list. */
export function parseKeywords(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/** The first keyword occurring in `text`, or null. Keywords must be pre-lowercased. */
export function firstKeywordMatch(text: string, keywords: string[]): string | null {
  if (keywords.length === 0) return null;
  const t = text.toLowerCase();
  return keywords.find((k) => t.includes(k)) ?? null;
}
