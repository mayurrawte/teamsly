import { auth } from "@/lib/auth/config";
import { getPresence } from "@/lib/graph/client";
import { NextResponse } from "next/server";
import { hasScopes } from "@/lib/auth/scopes";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Incremental consent: without Presence.Read.All just report nobody's presence
  // (dots stay grey) instead of hammering Graph for 403s.
  if (!hasScopes(session.scopes, ["Presence.Read.All"])) return NextResponse.json([]);

  const { userIds } = (await req.json().catch(() => ({}))) as { userIds?: string[] };
  const ids = [...new Set((userIds ?? []).filter(Boolean))].slice(0, 650);
  if (ids.length === 0) return NextResponse.json([]);

  try {
    const presence = await getPresence(session.accessToken, ids);
    return NextResponse.json(presence);
  } catch (err) {
    console.error("[graph] presence failed:", err);
    return NextResponse.json({ error: "Graph presence failed" }, { status: 502 });
  }
}
