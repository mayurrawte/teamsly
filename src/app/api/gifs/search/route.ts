import { NextRequest, NextResponse } from "next/server";

const TENOR_KEY = process.env.TENOR_API_KEY;

export async function GET(req: NextRequest) {
  if (!TENOR_KEY) {
    return NextResponse.json({ error: "TENOR_API_KEY not configured" }, { status: 503 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "trending";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);
  const pos = req.nextUrl.searchParams.get("pos") ?? "";

  const url = new URL("https://tenor.googleapis.com/v2/search");
  url.searchParams.set("q", q);
  url.searchParams.set("key", TENOR_KEY);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("media_filter", "gif,tinygif,nanogif");
  if (pos) url.searchParams.set("pos", pos);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Tenor error", status: res.status }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch GIFs" }, { status: 502 });
  }
}
