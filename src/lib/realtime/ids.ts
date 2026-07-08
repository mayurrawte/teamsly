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
