import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getTeams } from "@/lib/graph/client";

export async function GET(req: NextRequest) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const teams = await getTeams(token);
    return NextResponse.json(teams);
  } catch (err) {
    console.error("[mcp] getTeams failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}
