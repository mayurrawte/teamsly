// learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links#start-a-call
const BASE = "https://teams.microsoft.com/l/call/0/0";

export function buildCallDeeplink(
  emails: string[],
  opts?: { withVideo?: boolean }
): string | null {
  const filtered = emails.filter(Boolean);
  if (filtered.length === 0) return null;

  const users = filtered.map(encodeURIComponent).join(",");
  const url = new URL(BASE);
  url.searchParams.set("users", users);
  if (opts?.withVideo) url.searchParams.set("withVideo", "true");
  return url.toString();
}

export function openTeamsCall(
  emails: string[],
  opts?: { withVideo?: boolean }
): void {
  if (typeof window === "undefined") return;
  const url = buildCallDeeplink(emails, opts);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
