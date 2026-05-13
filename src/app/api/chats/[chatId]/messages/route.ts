import { auth } from "@/lib/auth/config";
import { getChatMessages, sendChatMessage, type ChatAttachment } from "@/lib/graph/client";
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

  const body = (await req.json()) as { content?: string; attachments?: unknown[] };
  const { content, attachments } = body;
  if (!content?.trim() && !attachments?.length) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // Validate attachments when present
  let validatedAttachments: ChatAttachment[] | undefined;
  if (attachments?.length) {
    for (const a of attachments) {
      const att = a as Record<string, unknown>;
      if (
        typeof att.id !== "string" ||
        att.contentType !== "reference" ||
        typeof att.contentUrl !== "string" ||
        !att.contentUrl.startsWith("https://") ||
        typeof att.name !== "string"
      ) {
        return NextResponse.json({ error: "Invalid attachment payload" }, { status: 400 });
      }
    }
    validatedAttachments = attachments as ChatAttachment[];
  }

  try {
    const msg = await sendChatMessage(session.accessToken, chatId, content ?? "", validatedAttachments);
    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: "Graph chat send failed" }, { status: 502 });
  }
}
