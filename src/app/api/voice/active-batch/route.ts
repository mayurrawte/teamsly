import { auth } from "@/lib/auth/config";
import { RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

const ROOM_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_ROOMS = 100;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { roomNames?: unknown }).roomNames)) {
    return NextResponse.json({ error: "roomNames must be an array" }, { status: 400 });
  }

  const rawNames: unknown[] = (body as { roomNames: unknown[] }).roomNames;
  const roomNames = rawNames
    .slice(0, MAX_ROOMS)
    .filter((n): n is string => typeof n === "string" && ROOM_NAME_RE.test(n) && n.length <= 100);

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    const counts: Record<string, number> = {};
    for (const name of roomNames) counts[name] = 0;
    return NextResponse.json({ counts });
  }

  const serverUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
  const svc = new RoomServiceClient(serverUrl, apiKey, apiSecret);

  const results = await Promise.allSettled(
    roomNames.map((name) => svc.listParticipants(name).then((ps) => ({ name, count: ps.length })))
  );

  const counts: Record<string, number> = {};
  for (let i = 0; i < roomNames.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      counts[roomNames[i]] = result.value.count;
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      counts[roomNames[i]] = msg.includes("not found") || msg.includes("404") || msg.includes("room_not_found") ? 0 : 0;
    }
  }

  return NextResponse.json({ counts });
}
