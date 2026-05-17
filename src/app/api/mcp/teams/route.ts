import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getTeams } from "@/lib/graph/client";

export async function GET(req: NextRequest) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = await getTeams(token);
  return NextResponse.json(teams);
}
