import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string; messageId: string }>;

// Client sends plain text; we convert to HTML because Graph requires contentType:"html".
function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { content?: unknown };
  const rawContent = typeof body.content === "string" ? body.content.trim() : "";
  if (!rawContent) return NextResponse.json({ error: "content is required" }, { status: 400 });

  const { chatId, messageId } = await params;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${chatId}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: { contentType: "html", content: textToHtml(rawContent) } }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Graph patch chat message failed", res.status, text);
      return NextResponse.json({ error: "Graph patch failed" }, { status: 502 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Graph patch chat message error", err);
    return NextResponse.json({ error: "Graph patch failed" }, { status: 502 });
  }
}

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
