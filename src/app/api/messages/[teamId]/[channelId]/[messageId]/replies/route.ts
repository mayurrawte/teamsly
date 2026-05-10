import { auth } from "@/lib/auth/config";
import { sendChannelReply } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ teamId: string; channelId: string; messageId: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId, messageId } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty reply" }, { status: 400 });

  try {
    const reply = await sendChannelReply(session.accessToken, teamId, channelId, messageId, content);
    return NextResponse.json(reply);
  } catch {
    return NextResponse.json({ error: "Graph reply failed" }, { status: 502 });
  }
}
