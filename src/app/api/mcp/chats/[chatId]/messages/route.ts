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
  try {
    const messages = await getChatMessages(token, chatId);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[mcp] getChatMessages failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const token = await mcpAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await params;
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });

  try {
    await sendChatMessage(token, chatId, body.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mcp] sendChatMessage failed:", err);
    return NextResponse.json({ error: "Graph request failed" }, { status: 502 });
  }
}
