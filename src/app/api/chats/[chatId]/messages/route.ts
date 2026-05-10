import { auth } from "@/lib/auth/config";
import { getChatMessages, sendChatMessage } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { chatId } = await params;
  try {
    const messages = await getChatMessages(session.accessToken, chatId);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "Graph chat messages failed" }, { status: 502 });
  }
}

export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { chatId } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  try {
    const msg = await sendChatMessage(session.accessToken, chatId, content);
    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: "Graph chat send failed" }, { status: 502 });
  }
}
