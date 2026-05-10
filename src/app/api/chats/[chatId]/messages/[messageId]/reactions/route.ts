import { auth } from "@/lib/auth/config";
import { setChatMessageReaction, unsetChatMessageReaction } from "@/lib/graph/client";
import { reactionEmoji } from "@/lib/utils/reactions";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string; messageId: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId, messageId } = await params;
  const { reactionType, action } = (await req.json()) as { reactionType?: string; action?: "set" | "unset" };
  if (!reactionType || (action !== "set" && action !== "unset")) {
    return NextResponse.json({ error: "Invalid reaction request" }, { status: 400 });
  }

  try {
    const unicodeReaction = reactionEmoji(reactionType);
    if (action === "set") {
      await setChatMessageReaction(session.accessToken, chatId, messageId, unicodeReaction);
    } else {
      await unsetChatMessageReaction(session.accessToken, chatId, messageId, unicodeReaction);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Graph reaction failed" }, { status: 502 });
  }
}
