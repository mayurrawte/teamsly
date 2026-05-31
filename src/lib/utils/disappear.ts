// Disappearing-message codec. NOT encryption: the key derives from the
// non-secret contextId, so anyone who knows the contextId and reads this
// code can recover the plaintext. Its only job is to keep the body from
// rendering as readable text in native Teams and to carry the expiry.

const PREFIX = "[TEAMSLY_E:";

export const DISAPPEAR_DURATIONS: { label: string; ms: number }[] = [
  { label: "30 seconds", ms: 30_000 },
  { label: "5 minutes", ms: 5 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
];

export interface DisappearPayload {
  body: string;
  disappearAt: number; // epoch ms
}

// How long to leave an undecodable disappearing blob (one of OUR OWN messages
// that fails to decode) before the sweep deletes it as orphaned. Well beyond
// the 1-hour max duration so a transient decode failure never deletes a valid
// message — only clearly-stranded blobs the sender can no longer read.
export const UNDECODABLE_BLOB_GRACE_MS = 24 * 60 * 60 * 1000;

const keyCache = new Map<string, Promise<CryptoKey>>();

export function getContextKey(contextId: string): Promise<CryptoKey> {
  let cached = keyCache.get(contextId);
  if (cached) return cached;
  cached = (async () => {
    const material = new TextEncoder().encode(`${contextId}:teamsly`);
    const digest = await crypto.subtle.digest("SHA-256", material);
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  })();
  keyCache.set(contextId, cached);
  return cached;
}

/**
 * Strip an outer HTML wrapper that Graph adds when messages are sent with
 * contentType="html" (the legacy behaviour before we fixed the send path).
 * Handles the common `<p>...</p>` wrapping Teams applies to plain-looking text.
 */
function stripHtmlWrapper(content: string): string {
  if (content.startsWith(PREFIX)) return content;
  // Graph typically wraps with <p> — strip exactly one opening and one closing tag.
  const inner = content.replace(/^<[a-z][^>]*>\s*/i, "").replace(/\s*<\/[a-z][^>]*>$/i, "");
  return inner;
}

export function isDisappearing(content: string): boolean {
  return stripHtmlWrapper(content).startsWith(PREFIX);
}

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function wrapMessage(
  contextId: string,
  body: string,
  disappearAt: number
): Promise<string> {
  const key = await getContextKey(contextId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ body, disappearAt } satisfies DisappearPayload)
  );
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );
  return `${PREFIX}${toB64Url(iv)}:${toB64Url(ct)}]`;
}

export async function unwrapMessage(
  contextId: string,
  content: string
): Promise<DisappearPayload | null> {
  const raw = stripHtmlWrapper(content);
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const inner = raw.slice(PREFIX.length, -1); // strip "[TEAMSLY_E:" and trailing "]"
    const [ivPart, ctPart] = inner.split(":");
    if (!ivPart || !ctPart) return null;
    const key = await getContextKey(contextId);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(ivPart) as BufferSource },
      key,
      fromB64Url(ctPart) as BufferSource
    );
    const plain = new Uint8Array(plainBuffer);
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as DisappearPayload;
    if (typeof parsed.body !== "string" || typeof parsed.disappearAt !== "number")
      return null;
    return parsed;
  } catch {
    return null;
  }
}
