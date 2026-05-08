import { auth } from "@/lib/auth/config";
import { getTeams } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const teams = await getTeams(session.accessToken);
  return NextResponse.json(teams);
}
