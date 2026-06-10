import { auth } from "@/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

// Tenor's officially documented demo key — published in their own API docs for
// development and low-traffic use. Override with TENOR_API_KEY in .env.local
// to use a dedicated key (free at console.cloud.google.com → Tenor API).
const TENOR_KEY = process.env.TENOR_API_KEY ?? "LIVDSRZULELA096";

export async function GET(req: NextRequest) {
  // Gate behind a session so anonymous traffic can't burn the Tenor key.
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);
  const pos = req.nextUrl.searchParams.get("pos") ?? "";

  const endpoint = q
    ? "https://api.tenor.com/v1/search"
    : "https://api.tenor.com/v1/trending";

  const url = new URL(endpoint);
  url.searchParams.set("key", TENOR_KEY);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("contentfilter", "medium");
  url.searchParams.set("media_filter", "minimal");
  if (q) url.searchParams.set("q", q);
  if (pos) url.searchParams.set("pos", pos);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Tenor error", status: res.status }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch GIFs" }, { status: 502 });
  }
}
