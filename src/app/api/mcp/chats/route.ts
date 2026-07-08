import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getChats } from "@/lib/graph/client";

export async function GET(req: NextRequest) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { chats } = await getChats(token, { pageSize: 50 });
    return NextResponse.json(chats);
  } catch (err) {
    console.error("[mcp] getChats failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}
