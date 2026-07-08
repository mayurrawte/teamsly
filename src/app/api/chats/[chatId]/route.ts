import { auth } from "@/lib/auth/config";
import { getChat } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await params;
  try {
    const chat = await getChat(session.accessToken, chatId);
    return NextResponse.json(chat);
  } catch (err) {
    // Only a genuine Graph 404 means the chat doesn't exist; anything else
    // (throttling, transient outage) must not masquerade as permanent absence.
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    console.error("[chats] getChat failed:", err);
    return NextResponse.json({ error: "Graph get chat failed" }, { status: 502 });
  }
}
