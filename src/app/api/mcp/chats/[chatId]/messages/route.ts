import { NextRequest, NextResponse } from "next/server";
import { mcpAuth } from "@/lib/mcp/auth";
import { getChatMessages, sendChatMessage } from "@/lib/graph/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await params;
  const messages = await getChatMessages(token, chatId);
  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await params;
  const body = (await req.json()) as { message?: string };
  if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });

  await sendChatMessage(token, chatId, body.message);
  return NextResponse.json({ ok: true });
}
