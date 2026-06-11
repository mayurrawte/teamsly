import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

type Params = Promise<{ teamId: string; channelId: string; messageId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId, messageId } = await params;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Graph get channel message failed", res.status, text);
      return NextResponse.json({ error: "Graph get failed" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("Graph get channel message error", err);
    return NextResponse.json({ error: "Graph get failed" }, { status: 502 });
  }
}
