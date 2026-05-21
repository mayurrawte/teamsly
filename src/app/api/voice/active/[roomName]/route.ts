import { auth } from "@/lib/auth/config";
import { RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

const ROOM_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ roomName: string }> }
) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomName } = await context.params;

  if (!roomName || !ROOM_NAME_RE.test(roomName) || roomName.length > 100) {
    return NextResponse.json({ error: "Invalid roomName" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ participants: [] });
  }

  const serverUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
  const svc = new RoomServiceClient(serverUrl, apiKey, apiSecret);

  try {
    const participants = await svc.listParticipants(roomName);
    return NextResponse.json({
      participants: participants.map((p) => ({ identity: p.identity, name: p.name })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Room doesn't exist yet — return empty list rather than erroring
    if (msg.includes("not found") || msg.includes("404") || msg.includes("room_not_found")) {
      return NextResponse.json({ participants: [] });
    }
    console.error("[voice] listParticipants failed:", msg);
    return NextResponse.json({ error: "Failed to list participants" }, { status: 500 });
  }
}
