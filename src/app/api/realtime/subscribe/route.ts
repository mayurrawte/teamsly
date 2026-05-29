import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { transport, resourceKey, type SubscriptionRecord } from "@/lib/realtime/pubsub";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;
// Teams chat IDs look like 19:xxx_yyy@unq.gbl.spaces — allow :, @, . in addition.
const CHAT_ID_SAFE = /^[A-Za-z0-9_@.:-]+$/;
const TTL_MS = 55 * 60 * 1000;
const TTL_SEC = TTL_MS / 1000;
const REUSE_IF_REMAINING_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    teamId?: string;
    channelId?: string;
    chatId?: string;
  };
  const { teamId, channelId, chatId } = body;
  const userId = session.user.id;
  const now = Date.now();

  let rkey: string;
  let resource: string;
  let makeRecord: (expiresAt: number) => SubscriptionRecord;

  if (chatId) {
    if (!CHAT_ID_SAFE.test(chatId)) {
      return NextResponse.json({ error: "Invalid chatId" }, { status: 400 });
    }
    rkey = resourceKey({ kind: "chat", chatId });
    resource = `/chats/${chatId}/messages`;
    makeRecord = (expiresAt) => ({
      userId,
      resourceType: "chat_message",
      chatId,
      expiresAt,
    });
  } else if (teamId && channelId && URL_SAFE.test(teamId) && URL_SAFE.test(channelId)) {
    rkey = resourceKey({ kind: "channel", teamId, channelId });
    resource = `/teams/${teamId}/channels/${channelId}/messages`;
    makeRecord = (expiresAt) => ({
      userId,
      resourceType: "channel_message",
      teamId,
      channelId,
      expiresAt,
    });
  } else {
    return NextResponse.json(
      { error: "Provide a valid chatId, or teamId and channelId" },
      { status: 400 }
    );
  }

  // Reuse an existing subscription unless it's within the recreate window.
  const existing = await transport.findActiveSub(userId, rkey);
  if (existing && existing.expiresAt - now > REUSE_IF_REMAINING_MS) {
    return NextResponse.json({
      subscriptionId: existing.subId,
      expiresAt: existing.expiresAt,
    });
  }

  const expiresAt = now + TTL_MS;
  const expirationDateTime = new Date(expiresAt).toISOString();

  const webhookBase =
    process.env.GRAPH_WEBHOOK_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://teamsly.vercel.app";
  const notificationUrl = `${webhookBase}/api/webhooks/graph`;

  const subBody = {
    changeType: "created,updated",
    notificationUrl,
    resource,
    // No resource data → no encryption certificate required. The notification
    // carries the message id; the client re-fetches the message content.
    includeResourceData: false,
    expirationDateTime,
    clientState: Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[realtime/subscribe] Graph subscription failed:", text);
    return NextResponse.json({ error: text }, { status: 502 });
  }

  const sub = (await res.json()) as { id: string };
  await transport.saveSub(sub.id, makeRecord(expiresAt), rkey, TTL_SEC);

  return NextResponse.json({ subscriptionId: sub.id, expiresAt });
}
