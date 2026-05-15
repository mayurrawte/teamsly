import { auth } from "@/lib/auth/config";
import {
  buildGraphMentions,
  rewriteBodyWithAtMarkup,
  type ClientMention,
} from "@/lib/graph/mentions";
import {
  getChatMessages,
  sendChatMessage,
  type ChatAttachment,
} from "@/lib/graph/client";
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

  const body = (await req.json()) as {
    content?: string;
    attachments?: unknown[];
    mentions?: ClientMention[];
  };
  const { content, attachments, mentions } = body;
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

  // Translate the client-side `mentions` list into the Graph `mentions[]`
  // shape and rewrite the body to wrap each `@Name` with `<at id="i">…</at>`.
  // `__everyone__` becomes a `conversation` identity set with
  // `conversationIdentityType: "chat"`.
  let graphMentions: ReturnType<typeof buildGraphMentions> | undefined;
  let finalContent = content ?? "";
  if (mentions?.length && finalContent) {
    const built = buildGraphMentions(mentions, {
      kind: "chat",
      chatId,
    });
    graphMentions = built;
    finalContent = rewriteBodyWithAtMarkup(finalContent, built);
  }

  try {
    const msg = await sendChatMessage(
      session.accessToken,
      chatId,
      finalContent,
      validatedAttachments,
      graphMentions
    );
    return NextResponse.json(msg);
  } catch {
    // Graph occasionally rejects a structured mentions[] for cross-tenant
    // DMs. Fall back to sending without the array — the `<at>` markup will
    // still render a pill in real Teams clients, just without the notification
    // ping. Better than a 502 to the user.
    if (graphMentions && finalContent) {
      try {
        const msg = await sendChatMessage(
          session.accessToken,
          chatId,
          finalContent,
          validatedAttachments
        );
        return NextResponse.json(msg);
      } catch {
        return NextResponse.json({ error: "Graph chat send failed" }, { status: 502 });
      }
    }
    return NextResponse.json({ error: "Graph chat send failed" }, { status: 502 });
  }
}
