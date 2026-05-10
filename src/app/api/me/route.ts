import { auth } from "@/lib/auth/config";
import { getMe } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const me = await getMe(session.accessToken);
    return NextResponse.json(me);
  } catch {
    return NextResponse.json({ error: "Graph me failed" }, { status: 502 });
  }
}
