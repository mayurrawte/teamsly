/**
 * Incremental consent: sign in with MINIMAL_SCOPE, then ask for a feature's
 * extra scopes the first time that feature is opened. Entra returns the union
 * of everything the user has consented to, so we store the granted scope string
 * from the token response and check it here.
 */
export type Feature = "files" | "presence" | "calendar";

export const FEATURE_SCOPES: Record<Feature, string[]> = {
  files: ["Files.Read.All", "Files.ReadWrite"],
  presence: ["Presence.Read.All", "Presence.ReadWrite"],
  calendar: ["Calendars.Read"],
};

export const FEATURE_LABELS: Record<Feature, { title: string; why: string }> = {
  files: { title: "Files", why: "browse and preview files shared in your chats and channels, and upload attachments" },
  presence: { title: "Presence", why: "show who is online and let you set your own status" },
  calendar: { title: "Meetings", why: "list your upcoming meetings and join links" },
};

export function parseScopes(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x.replace(/^https:\/\/graph\.microsoft\.com\//, ""));
}

export function hasScopes(granted: string | null | undefined, needed: string[]): boolean {
  const have = new Set(parseScopes(granted));
  return needed.every((n) => have.has(n));
}

export function unionScopes(...lists: Array<string | null | undefined>): string {
  const out: string[] = [];
  for (const l of lists) for (const s of parseScopes(l)) if (!out.includes(s)) out.push(s);
  return out.join(" ");
}

export function missingScopesFor(granted: string | null | undefined, feature: Feature): string[] {
  const have = new Set(parseScopes(granted));
  return FEATURE_SCOPES[feature].filter((s) => !have.has(s));
}
