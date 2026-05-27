import { auth } from "@/lib/auth/config";
import { getChats, getMe, getOrCreateOneOnOneChat } from "@/lib/graph/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const encodedNextLink = searchParams.get("next");
  const nextLink = encodedNextLink ? decodeURIComponent(encodedNextLink) : undefined;

  try {
    const page = await getChats(session.accessToken, { nextLink });
    // Graph already orders by `lastMessagePreview/createdDateTime desc`. Re-sorting
    // by `lastUpdatedDateTime` (which only changes on rename / membership edits)
    // was undoing that order, so we trust the server response as-is.
    return NextResponse.json({ chats: page.chats, nextLink: page.nextLink });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph] chats failed:", msg);
    return NextResponse.json({ error: "Graph chats failed", detail: msg }, { status: 502 });
  }
}

// Find-or-create a 1:1 chat with a user, so search results for people the user
// hasn't messaged yet can open a DM. Returns the chat (existing or new).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  try {
    const me = await getMe(session.accessToken);
    const chat = await getOrCreateOneOnOneChat(session.accessToken, me.id, userId);
    return NextResponse.json(chat);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph] create chat failed:", msg);
    return NextResponse.json({ error: "Create chat failed", detail: msg }, { status: 502 });
  }
}
