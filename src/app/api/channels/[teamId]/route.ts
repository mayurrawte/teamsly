import { auth } from "@/lib/auth/config";
import { getChannels } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await params;
  const channels = await getChannels(session.accessToken, teamId);
  return NextResponse.json(channels);
}
