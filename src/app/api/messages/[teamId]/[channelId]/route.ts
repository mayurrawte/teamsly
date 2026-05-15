import { auth } from "@/lib/auth/config";
import { getMessages, sendMessage } from "@/lib/graph/client";
import {
  buildGraphMentions,
  rewriteBodyWithAtMarkup,
  type ClientMention,
} from "@/lib/graph/mentions";
import { NextResponse } from "next/server";

type Params = Promise<{ teamId: string; channelId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, channelId } = await params;
  try {
    const messages = await getMessages(session.accessToken, teamId, channelId);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "Graph messages failed" }, { status: 502 });
  }
}

export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, channelId } = await params;
  const body = (await req.json()) as { content?: string; mentions?: ClientMention[] };
  const { content, mentions } = body;
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  // Translate client mentions into Graph's `mentions[]` shape and wrap each
  // `@Name` in the body with `<at id="i">…</at>` markup. `__everyone__`
  // resolves to a `conversation` identity set with
  // `conversationIdentityType: "channel"`.
  let graphMentions: ReturnType<typeof buildGraphMentions> | undefined;
  let finalContent = content;
  if (mentions?.length) {
    const built = buildGraphMentions(mentions, {
      kind: "channel",
      teamId,
      channelId,
    });
    graphMentions = built;
    finalContent = rewriteBodyWithAtMarkup(finalContent, built);
  }

  try {
    const msg = await sendMessage(
      session.accessToken,
      teamId,
      channelId,
      finalContent,
      graphMentions
    );
    return NextResponse.json(msg);
  } catch {
    // Same fallback as the chat route: retry without the structured array
    // so we still ship the `<at>` markup even if Graph rejects the shape.
    if (graphMentions) {
      try {
        const msg = await sendMessage(session.accessToken, teamId, channelId, finalContent);
        return NextResponse.json(msg);
      } catch {
        return NextResponse.json({ error: "Graph send failed" }, { status: 502 });
      }
    }
    return NextResponse.json({ error: "Graph send failed" }, { status: 502 });
  }
}
