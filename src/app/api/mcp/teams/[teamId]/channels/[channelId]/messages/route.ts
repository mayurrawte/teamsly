import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getMessages, sendMessage } from "@/lib/graph/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; channelId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId } = await params;
  try {
    const messages = await getMessages(token, teamId, channelId);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[mcp] getMessages failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; channelId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId } = await params;
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });

  try {
    await sendMessage(token, teamId, channelId, body.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mcp] sendMessage failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}
