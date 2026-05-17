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
  const messages = await getMessages(token, teamId, channelId);
  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; channelId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId } = await params;
  const body = (await req.json()) as { message?: string };
  if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });

  await sendMessage(token, teamId, channelId, body.message);
  return NextResponse.json({ ok: true });
}
