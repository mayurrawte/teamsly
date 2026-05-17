import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getChats } from "@/lib/graph/client";

export async function GET(req: NextRequest) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chats } = await getChats(token, { pageSize: 50 });
  return NextResponse.json(chats);
}
