import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getChannels } from "@/lib/graph/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  try {
    const channels = await getChannels(token, teamId);
    return NextResponse.json(channels);
  } catch (err) {
    console.error("[mcp] getChannels failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}
