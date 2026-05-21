import { NextRequest } from "next/server";
import { getSubscription, publish } from "@/lib/realtime/pubsub";

interface GraphNotification {
  subscriptionId: string;
  resourceData?: { id?: string };
}

interface GraphNotificationPayload {
  value: GraphNotification[];
}

export async function POST(req: NextRequest) {
  const validationToken = req.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  let payload: GraphNotificationPayload;
  try {
    payload = (await req.json()) as GraphNotificationPayload;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  for (const notification of payload.value ?? []) {
    const record = getSubscription(notification.subscriptionId);
    if (!record) {
      console.warn("[webhooks/graph] unknown subscriptionId", notification.subscriptionId);
      continue;
    }
    const messageId = notification.resourceData?.id;
    if (!messageId) continue;
    publish(record.userId, {
      type: "channel_message",
      teamId: record.teamId,
      channelId: record.channelId,
      messageId,
    });
  }

  return Response.json({ ok: true });
}
