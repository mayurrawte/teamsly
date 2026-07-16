// Conversation ids reach realtime code in two forms: percent-encoded
// (Next.js does not decode dynamic route params, and views pass them through
// as-is) and raw (Graph payloads). Normalize to the raw Graph form before
// validating, building Graph resource paths, or comparing against realtime
// event payloads. Malformed encodings return null.
export function decodeGraphId(id: string): string | null {
  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
}

// URL paths embedding conversation ids also come in both spellings —
// location.pathname may carry raw : and @ while app-built hrefs carry the
// percent-encoded route param (or vice versa). Comparing mixed forms is the
// bug class behind the open-conversation suppression failures; always compare
// through this. Malformed escapes fall back to comparing as-is.
export function sameDecodedPath(a: string, b: string): boolean {
  return (decodeGraphId(a) ?? a) === (decodeGraphId(b) ?? b);
}
