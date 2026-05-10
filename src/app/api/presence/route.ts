import { auth } from "@/lib/auth/config";
import { getPresence } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userIds } = (await req.json()) as { userIds?: string[] };
  const ids = [...new Set((userIds ?? []).filter(Boolean))].slice(0, 650);
  if (ids.length === 0) return NextResponse.json([]);

  try {
    const presence = await getPresence(session.accessToken, ids);
    return NextResponse.json(presence);
  } catch {
    return NextResponse.json({ error: "Graph presence failed" }, { status: 502 });
  }
}
