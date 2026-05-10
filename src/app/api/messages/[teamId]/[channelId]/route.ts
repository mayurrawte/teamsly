import { auth } from "@/lib/auth/config";
import { getMessages, sendMessage } from "@/lib/graph/client";
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
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  try {
    const msg = await sendMessage(session.accessToken, teamId, channelId, content);
    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: "Graph send failed" }, { status: 502 });
  }
}
