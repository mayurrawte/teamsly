import { auth } from "@/lib/auth/config";
import { getChats, getMe, getOrCreateOneOnOneChat, createGroupChat } from "@/lib/graph/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const encodedNextLink = searchParams.get("next");
  const nextLink = encodedNextLink ? decodeURIComponent(encodedNextLink) : undefined;
  // The nextLink is forwarded to the Graph SDK, which fetches whatever host it
  // names — reject anything that isn't an actual Graph paging URL to prevent a
  // caller from turning this into a server-side request to an arbitrary host.
  if (nextLink && !nextLink.startsWith("https://graph.microsoft.com/")) {
    return NextResponse.json({ error: "Invalid next link" }, { status: 400 });
  }

  try {
    const page = await getChats(session.accessToken, { nextLink });
    // Graph already orders by `lastMessagePreview/createdDateTime desc`. Re-sorting
    // by `lastUpdatedDateTime` (which only changes on rename / membership edits)
    // was undoing that order, so we trust the server response as-is.
    return NextResponse.json({ chats: page.chats, nextLink: page.nextLink });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph] chats failed:", msg);
    return NextResponse.json({ error: "Graph chats failed" }, { status: 502 });
  }
}

// Create a chat: 1 user id -> find-or-create 1:1; 2+ -> group (optional topic).
// Accepts the legacy `{ userId }` shape (search-result "open DM") too.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { userId?: string; userIds?: string[]; topic?: string };
  const ids = (body.userIds ?? (body.userId ? [body.userId] : [])).filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
  if (ids.length === 0) return NextResponse.json({ error: "Missing userIds" }, { status: 400 });

  try {
    const me = await getMe(session.accessToken);
    const chat =
      ids.length === 1
        ? await getOrCreateOneOnOneChat(session.accessToken, me.id, ids[0])
        : await createGroupChat(session.accessToken, me.id, ids, body.topic);
    return NextResponse.json(chat);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph] create chat failed:", msg);
    return NextResponse.json({ error: "Create chat failed" }, { status: 502 });
  }
}
