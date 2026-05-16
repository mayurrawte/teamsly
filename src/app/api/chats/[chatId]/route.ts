import { auth } from "@/lib/auth/config";
import { getChat } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await params;
  try {
    const chat = await getChat(session.accessToken, chatId);
    return NextResponse.json(chat);
  } catch {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
}
