import { auth } from "@/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

// GIF search via the Klipy API. Google shut down the public Tenor API
// (hard cutoff 2026-06-30, no new keys), so we moved off it. Klipy is a
// near-Tenor, lifetime-free GIF API — get a key at https://klipy.com/developers
// and set KLIPY_API_KEY. The key is passed as a URL path segment.
const KLIPY_KEY = process.env.KLIPY_API_KEY ?? "";
const KLIPY_BASE = "https://api.klipy.com/api/v1";

// One format variant inside a Klipy item, e.g. file.hd.gif = { url, width, height }.
type GifFormat = { url?: string; width?: number; height?: number };
// tier ("hd"|"md"|"sm"|"xs") -> format ("gif"|"mp4"|"jpg"|...) -> variant
type KlipyFile = Record<string, Record<string, GifFormat> | undefined>;
interface KlipyItem {
  id?: string | number;
  title?: string;
  file?: KlipyFile;
  files?: KlipyFile;
}

// Shape the GIF picker (GifPicker.tsx) expects — kept stable across providers.
interface MediaFormat {
  url: string;
  dims: [number, number];
}

// Pick the first available .gif variant across the given size tiers, with a
// fallback for payloads that nest the format directly under `file` (no tier).
function pickGif(file: KlipyFile | undefined, tiers: string[]): GifFormat | undefined {
  if (!file) return undefined;
  for (const t of tiers) {
    const g = file[t]?.gif;
    if (g?.url) return g;
  }
  const flat = (file as unknown as Record<string, GifFormat>).gif;
  return flat?.url ? flat : undefined;
}

function toMediaFormat(g: GifFormat | undefined): MediaFormat | undefined {
  if (!g?.url) return undefined;
  return { url: g.url, dims: [g.width ?? 0, g.height ?? 0] };
}

export async function GET(req: NextRequest) {
  // Gate behind a session so anonymous traffic can't burn the Klipy key.
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Not configured: return a graceful empty result so the picker shows its
  // empty state instead of erroring.
  if (!KLIPY_KEY) {
    return NextResponse.json({ results: [] });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const perPage = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "24"), 8), 50);
  const page = req.nextUrl.searchParams.get("page") ?? "1";

  const url = new URL(`${KLIPY_BASE}/${KLIPY_KEY}/gifs/${q ? "search" : "trending"}`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", page);
  if (q) url.searchParams.set("q", q);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Klipy error", status: res.status }, { status: 502 });
    }
    const json = await res.json();
    // Klipy wraps results as { result, data: { data: [...] } }; some payloads
    // return the array directly under `data`. Handle both.
    const raw = (json as { data?: unknown })?.data;
    const items: KlipyItem[] = Array.isArray(raw)
      ? (raw as KlipyItem[])
      : ((raw as { data?: KlipyItem[] })?.data ?? []);

    const results = items
      .map((it) => {
        const file = it.file ?? it.files;
        const full = toMediaFormat(pickGif(file, ["hd", "md", "sm", "xs"]));
        const preview = toMediaFormat(pickGif(file, ["sm", "xs", "md", "hd"]));
        const gif = full ?? preview;
        const tinygif = preview ?? full;
        if (!gif || !tinygif) return null;
        return {
          id: String(it.id ?? gif.url),
          title: it.title ?? "",
          media: [{ gif, tinygif }],
        };
      })
      .filter(Boolean);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Failed to fetch GIFs" }, { status: 502 });
  }
}
