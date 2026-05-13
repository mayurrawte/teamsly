import { auth } from "@/lib/auth/config";
import { getChannelMembers } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; channelId: string }> }
) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, channelId } = await params;
  try {
    const members = await getChannelMembers(session.accessToken, teamId, channelId);
    return NextResponse.json(members);
  } catch (err) {
    console.error("[graph] channel members failed:", err);
    return NextResponse.json({ error: "Graph channel members failed" }, { status: 502 });
  }
}
