import { auth } from "@/lib/auth/config";
import { getChats } from "@/lib/graph/client";
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
    console.error("[graph] chats failed:", err);
    return NextResponse.json({ error: "Graph chats failed" }, { status: 502 });
  }
}
