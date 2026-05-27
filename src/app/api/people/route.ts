import { auth } from "@/lib/auth/config";
import { searchPeople } from "@/lib/graph/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const people = await searchPeople(session.accessToken, q);
    return NextResponse.json(people);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph] people search failed:", msg);
    return NextResponse.json({ error: "People search failed", detail: msg }, { status: 502 });
  }
}
