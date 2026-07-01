import { auth } from "@/lib/auth/config";
import { replyToChatMessage } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string; messageId: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId, messageId } = await params;
  let content: unknown;
  try {
    ({ content } = (await req.json()) as { content?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Empty reply" }, { status: 400 });
  }

  try {
    const reply = await replyToChatMessage(session.accessToken, chatId, messageId, content);
    return NextResponse.json(reply);
  } catch {
    return NextResponse.json({ error: "Graph chat reply failed" }, { status: 502 });
  }
}
