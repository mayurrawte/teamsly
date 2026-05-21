import { auth } from "@/lib/auth/config";
import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

const ROOM_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { roomName?: string };
  const { roomName } = body;

  if (!roomName || !ROOM_NAME_RE.test(roomName) || roomName.length > 100) {
    return NextResponse.json({ error: "Invalid roomName" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 503 });
  }

  const userId = (session.user as { id?: string; email?: string })?.id ?? session.user?.email ?? "unknown";
  const displayName = session.user?.name ?? userId;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: displayName,
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const jwt = await at.toJwt();

  return NextResponse.json({ token: jwt, url });
}
