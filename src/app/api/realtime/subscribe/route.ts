import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { transport, resourceKey, type SubscriptionRecord } from "@/lib/realtime/pubsub";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;
// Teams chat IDs look like 19:xxx_yyy@unq.gbl.spaces — allow :, @, . in addition.
const CHAT_ID_SAFE = /^[A-Za-z0-9_@.:-]+$/;
const TTL_MS = 55 * 60 * 1000;
const TTL_SEC = TTL_MS / 1000;
const REUSE_IF_REMAINING_MS = 15 * 60 * 1000;

// Subscription creation is a raw fetch (not the SDK, which already retries via
// its default middleware), so honor Graph throttling here: retry 429/503 a
// couple of times, respecting Retry-After, before surfacing the failure.
async function graphPostWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let res = await fetch(url, init);
  for (let i = 1; i < attempts && (res.status === 429 || res.status === 503); i++) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const delayMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** i) * 1000;
    await new Promise((r) => setTimeout(r, delayMs));
    res = await fetch(url, init);
  }
  return res;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    teamId?: string;
    channelId?: string;
    chatId?: string;
  };
  const { teamId, channelId, chatId } = body;
  const userId = session.userId;
  const now = Date.now();

  // Per-subscription secret. Graph echoes it in every notification; the webhook
  // handler rejects any payload whose clientState doesn't match the stored value.
  const clientState = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
      clientState,
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
      clientState,
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
    clientState,
  };

  const res = await graphPostWithRetry("https://graph.microsoft.com/v1.0/subscriptions", {
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
    return NextResponse.json({ error: "Graph subscription failed" }, { status: 502 });
  }

  const sub = (await res.json()) as { id: string };
  try {
    await transport.saveSub(sub.id, makeRecord(expiresAt), rkey, TTL_SEC);
  } catch (err) {
    // Persisting the record failed — without it the webhook handler can't match
    // notifications, so realtime would be silently dead while the Graph
    // subscription still burns quota. Fail closed: tear down the just-created
    // subscription and tell the client to keep polling (don't report success).
    console.error("[realtime/subscribe] saveSub failed; removing Graph subscription:", err);
    await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${sub.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => {});
    return NextResponse.json({ error: "Subscription store unavailable" }, { status: 503 });
  }

  return NextResponse.json({ subscriptionId: sub.id, expiresAt });
}
