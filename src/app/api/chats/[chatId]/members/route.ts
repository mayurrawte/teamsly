import { auth } from "@/lib/auth/config";
import { getChatMembers } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ chatId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { chatId } = await params;
  try {
    const members = await getChatMembers(session.accessToken, chatId);
    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: "Graph chat members failed" }, { status: 502 });
  }
}
