import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string; messageId: string }>;

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId, messageId } = await params;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${chatId}/messages/${messageId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Graph delete chat message failed", res.status, body);
      return NextResponse.json({ error: "Graph delete failed" }, { status: 502 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Graph delete chat message error", err);
    return NextResponse.json({ error: "Graph delete failed" }, { status: 502 });
  }
}
