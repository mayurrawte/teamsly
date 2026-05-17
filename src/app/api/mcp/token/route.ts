import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    token: session.accessToken,
    note: "This token expires in ~1 hour. Return to teamsly.app to get a fresh one.",
  });
}
