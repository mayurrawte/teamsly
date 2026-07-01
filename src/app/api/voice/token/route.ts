import { auth } from "@/lib/auth/config";
import { voiceRoomNameFor } from "@/lib/voice/types";
import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

/** True only if the caller's delegated token can read the resource (i.e. is a member). */
async function graphOk(path: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    chatId?: string;
    teamId?: string;
    channelId?: string;
  };
  const { chatId, teamId, channelId } = body;

  // Verify the caller is a member of the target chat/channel BEFORE issuing a
  // token, then derive the room name from the (verified) ids — the client never
  // picks the room directly, so it can't join a call it isn't a party to.
  let roomName: string;
  if (typeof chatId === "string" && chatId) {
    if (!(await graphOk(`/me/chats/${encodeURIComponent(chatId)}`, session.accessToken))) {
      return NextResponse.json({ error: "Not a member of this chat" }, { status: 403 });
    }
    roomName = voiceRoomNameFor({ chatId });
  } else if (typeof teamId === "string" && teamId && typeof channelId === "string" && channelId) {
    if (!(await graphOk(`/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}`, session.accessToken))) {
      return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
    }
    roomName = voiceRoomNameFor({ teamId, channelId });
  } else {
    return NextResponse.json(
      { error: "Provide a chatId, or teamId and channelId" },
      { status: 400 }
    );
  }

  if (!roomName || roomName.length > 200) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 503 });
  }

  const userId = session.userId || session.user?.email || "unknown";
  const displayName = session.user?.name ?? userId;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: displayName,
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const jwt = await at.toJwt();

  return NextResponse.json({ token: jwt, url, roomName });
}
