import { auth } from "@/lib/auth/config";
import { getChats } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const chats = await getChats(session.accessToken);
    return NextResponse.json(chats);
  } catch (err) {
    console.error("[graph] chats failed:", err);
    return NextResponse.json({ error: "Graph chats failed" }, { status: 502 });
  }
}
