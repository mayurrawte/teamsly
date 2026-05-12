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
    // Sort by most recent activity first; entries without a date go to the end.
    const sorted = [...page.chats].sort((a, b) => {
      const aTime = a.lastUpdatedDateTime ? new Date(a.lastUpdatedDateTime).getTime() : 0;
      const bTime = b.lastUpdatedDateTime ? new Date(b.lastUpdatedDateTime).getTime() : 0;
      return bTime - aTime;
    });
    return NextResponse.json({ chats: sorted, nextLink: page.nextLink });
  } catch (err) {
    console.error("[graph] chats failed:", err);
    return NextResponse.json({ error: "Graph chats failed" }, { status: 502 });
  }
}
