import { NextRequest } from "next/server";
import { transport } from "@/lib/realtime/pubsub";

interface GraphNotification {
  subscriptionId: string;
  clientState?: string;
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
    const record = await transport.getSub(notification.subscriptionId);
    if (!record) {
      console.warn("[webhooks/graph] unknown subscriptionId", notification.subscriptionId);
      continue;
    }
    // Reject forged notifications: the clientState must match the secret we
    // generated when creating the subscription. subscriptionIds are not secret.
    if (!notification.clientState || notification.clientState !== record.clientState) {
      console.warn("[webhooks/graph] clientState mismatch for", notification.subscriptionId);
      continue;
    }
    const messageId = notification.resourceData?.id;
    if (!messageId) continue;
    if (record.resourceType === "chat_message") {
      await transport.publish(record.userId, {
        type: "chat_message",
        chatId: record.chatId,
        messageId,
      });
    } else {
      await transport.publish(record.userId, {
        type: "channel_message",
        teamId: record.teamId,
        channelId: record.channelId,
        messageId,
      });
    }
  }

  return Response.json({ ok: true });
}
