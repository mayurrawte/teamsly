import { auth } from "@/lib/auth/config";
import { getChats } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const chats = await getChats(session.accessToken);
    // Sort by most recent activity first; entries without a date go to the end.
    const sorted = [...chats].sort((a, b) => {
      const aTime = a.lastUpdatedDateTime ? new Date(a.lastUpdatedDateTime).getTime() : 0;
      const bTime = b.lastUpdatedDateTime ? new Date(b.lastUpdatedDateTime).getTime() : 0;
      return bTime - aTime;
    });
    return NextResponse.json(sorted);
  } catch (err) {
    console.error("[graph] chats failed:", err);
    return NextResponse.json({ error: "Graph chats failed" }, { status: 502 });
  }
}
