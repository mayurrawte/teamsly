/**
 * URL detector for the rich link-preview cards rendered inside messages.
 * Mirrors the shape of `github-detect.ts` but covers a wider grid:
 *
 *  - YouTube videos      → thumbnail + title placeholder
 *  - Loom recordings     → loom watermark card
 *  - Figma files/protos  → file-name card
 *  - Teams meetings      → "Open in Teams" call-to-action
 *  - msteams: deep links → click-to-call / click-to-chat
 *
 * Detection is purely string-based — we don't call any external API to
 * decide what kind of link it is. The per-type render components decide
 * whether they need to enrich with a fetch (most don't; YouTube thumbs
 * are predictable, Teams deep links carry everything they need).
 */

export type DetectedLink =
  | { kind: "youtube"; url: string; videoId: string }
  | { kind: "loom"; url: string; videoId: string }
  | { kind: "figma"; url: string; fileName: string }
  | { kind: "teams-meeting"; url: string }
  | { kind: "teams-deeplink"; url: string; action: "call" | "chat" | "meet" | "other" };

const YOUTUBE_RE = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?[^\s]*?v=|youtu\.be\/)([\w-]{11})/g;
const LOOM_RE = /https?:\/\/(?:www\.)?loom\.com\/share\/([\w-]+)/g;
const FIGMA_RE = /https?:\/\/(?:www\.)?figma\.com\/(?:file|proto|design|board)\/[\w-]+\/([^\s/?#]*)/g;
// Microsoft Teams meeting join URLs. Both common shapes:
//   https://teams.microsoft.com/l/meetup-join/...
//   https://teams.live.com/meet/<id>
const TEAMS_MEET_RE = /https?:\/\/teams\.(?:microsoft|live)\.com\/(?:l\/meetup-join|meet)\/[^\s)]+/g;
// Generic msteams: deep links — calls, chats, meetings. We don't need to
// peek inside; the action lives in path segment 2 (after `msteams:/l/`).
const TEAMS_DEEPLINK_RE = /msteams:\/\/?l\/(call|chat|meetup-join|meeting|deeplink)\/[^\s)]+/g;

const MAX_PER_MESSAGE = 4;

export function detectRichLinks(text: string): DetectedLink[] {
  const out: DetectedLink[] = [];
  const seen = new Set<string>();
  const push = (link: DetectedLink) => {
    if (seen.has(link.url) || out.length >= MAX_PER_MESSAGE) return;
    seen.add(link.url);
    out.push(link);
  };

  let m: RegExpExecArray | null;

  YOUTUBE_RE.lastIndex = 0;
  while ((m = YOUTUBE_RE.exec(text)) !== null) {
    push({ kind: "youtube", url: m[0], videoId: m[1] });
  }

  LOOM_RE.lastIndex = 0;
  while ((m = LOOM_RE.exec(text)) !== null) {
    push({ kind: "loom", url: m[0], videoId: m[1] });
  }

  FIGMA_RE.lastIndex = 0;
  while ((m = FIGMA_RE.exec(text)) !== null) {
    // The slug after the file id is URL-encoded; decode for display, fall
    // back to the slug verbatim if decoding throws.
    let name = m[1] || "Figma file";
    try {
      name = decodeURIComponent(name).replace(/-/g, " ");
    } catch {
      /* keep raw */
    }
    push({ kind: "figma", url: m[0], fileName: name });
  }

  TEAMS_MEET_RE.lastIndex = 0;
  while ((m = TEAMS_MEET_RE.exec(text)) !== null) {
    push({ kind: "teams-meeting", url: m[0] });
  }

  TEAMS_DEEPLINK_RE.lastIndex = 0;
  while ((m = TEAMS_DEEPLINK_RE.exec(text)) !== null) {
    const seg = m[1].toLowerCase();
    const action: "call" | "chat" | "meet" | "other" =
      seg === "call"
        ? "call"
        : seg === "chat"
          ? "chat"
          : seg === "meetup-join" || seg === "meeting"
            ? "meet"
            : "other";
    push({ kind: "teams-deeplink", url: m[0], action });
  }

  return out;
}
