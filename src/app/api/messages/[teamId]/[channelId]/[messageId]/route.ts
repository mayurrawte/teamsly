import { auth } from "@/lib/auth/config";
import { softDeleteChannelMessage } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ teamId: string; channelId: string; messageId: string }>;

// Delete a channel message. Graph has no HTTP DELETE for chat/channel messages
// — deletion is the softDelete action (POST, empty body). Used by the
// disappearing-message sweep to remove the sender's own expired messages.
// Only the author may delete; Graph returns 403 for anyone else.
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId, messageId } = await params;
  try {
    await softDeleteChannelMessage(session.accessToken, teamId, channelId, messageId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Graph softDelete channel message failed", err);
    return NextResponse.json({ error: "Graph delete failed" }, { status: 502 });
  }
}
