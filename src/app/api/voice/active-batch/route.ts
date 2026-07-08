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
      // Room doesn't exist (nobody in the call) is the normal case — report 0
      // silently. Anything else (auth failure, LiveKit outage) also degrades
      // to 0 to keep the response shape, but gets logged so real failures
      // aren't invisible. LiveKit's TwirpError signals not-found via the
      // structured status/code fields, not the message text.
      const status = (result.reason as { status?: number })?.status;
      const code = (result.reason as { code?: string })?.code;
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const roomMissing =
        status === 404 || code === "not_found" || msg.includes("not found") || msg.includes("does not exist");
      if (!roomMissing) {
        console.error("[voice] batch listParticipants failed for", roomNames[i], msg);
      }
      counts[roomNames[i]] = 0;
    }
  }

  return NextResponse.json({ counts });
}
