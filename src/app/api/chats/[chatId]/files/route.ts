import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await params;
  const client = getGraphClient(session.accessToken);

  try {
    // Graph has no dedicated "files in chat" collection; the documented
    // workaround is to scan messages for reference-type attachments.
    const res = await client
      .api(`/chats/${chatId}/messages`)
      .top(50)
      .select("id,attachments,from,createdDateTime")
      .get() as {
        value: Array<{
          id: string;
          createdDateTime: string;
          from?: { user?: { displayName?: string } };
          attachments?: Array<{
            id: string;
            contentType: string;
            name?: string | null;
            contentUrl?: string | null;
          }>;
        }>;
      };

    const items: MSChatFileAttachment[] = [];

    for (const msg of res.value) {
      if (!msg.attachments) continue;
      for (const att of msg.attachments) {
        if (att.contentType !== "reference") continue;
        if (!att.contentUrl) continue;
        items.push({
          id: att.id,
          name: att.name ?? "File",
          contentUrl: att.contentUrl,
          sharedBy: { displayName: msg.from?.user?.displayName },
          sharedDateTime: msg.createdDateTime,
        });
      }
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Graph chat files failed" }, { status: 502 });
  }
}
