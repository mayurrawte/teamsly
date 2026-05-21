import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import {
  listUserSubscriptions,
  registerSubscription,
} from "@/lib/realtime/pubsub";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;
const TTL_MS = 55 * 60 * 1000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { teamId?: string; channelId?: string };
  const { teamId, channelId } = body;
  if (!teamId || !channelId || !URL_SAFE.test(teamId) || !URL_SAFE.test(channelId)) {
    return NextResponse.json({ error: "Invalid teamId or channelId" }, { status: 400 });
  }

  const userId = session.user.id;
  const now = Date.now();

  const existing = listUserSubscriptions(userId).find(
    ([, r]) =>
      r.teamId === teamId && r.channelId === channelId && r.expiresAt > now
  );
  if (existing) {
    return NextResponse.json({ subscriptionId: existing[0], expiresAt: existing[1].expiresAt });
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
    resource: `/teams/${teamId}/channels/${channelId}/messages`,
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
  registerSubscription(sub.id, {
    userId,
    resourceType: "channel_message",
    teamId,
    channelId,
    expiresAt,
  });

  return NextResponse.json({ subscriptionId: sub.id, expiresAt });
}
