// learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links
const CALL_BASE = "https://teams.microsoft.com/l/call/0/0";
const MEETING_NEW_BASE = "https://teams.microsoft.com/l/meeting/new";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Teams deeplinks accept UPN (email) or MRI. Bare AAD GUIDs need the
 * `8:orgid:` prefix to be interpreted as MRI; without it the Teams client
 * ignores the users= param.
 */
function toTeamsIdentifier(id: string): string {
  return UUID_RE.test(id) ? `8:orgid:${id}` : id;
}

/**
 * Build a Teams call deeplink. Per the Teams docs the `users` param accepts
 * any of: UPN, AAD user GUID, or email. We pass whatever the caller supplies
 * — email when present, otherwise the user id.
 */
export function buildCallDeeplink(
  identifiers: string[],
  opts?: { withVideo?: boolean }
): string | null {
  const filtered = identifiers.filter(Boolean);
  if (filtered.length === 0) return null;

  const users = filtered.map(toTeamsIdentifier).map(encodeURIComponent).join(",");
  const url = new URL(CALL_BASE);
  url.searchParams.set("users", users);
  if (opts?.withVideo) url.searchParams.set("withVideo", "true");
  return url.toString();
}

export function openTeamsCall(
  identifiers: string[],
  opts?: { withVideo?: boolean }
): void {
  if (typeof window === "undefined") return;
  const url = buildCallDeeplink(identifiers, opts);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Channels can't do a 1:1 call — Teams' equivalent is "Meet now" which
 * spawns a new meeting via the meeting/new deeplink with the channel name
 * as the meeting subject. We can't pre-toggle video here (the user picks
 * it on the Teams compose screen), but the deeplink is still the right
 * hand-off because the calling stack is paid + heavy.
 */
export function openTeamsChannelMeeting(subject: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(MEETING_NEW_BASE);
  if (subject) url.searchParams.set("subject", subject);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}
