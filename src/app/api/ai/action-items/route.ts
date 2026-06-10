import { getOpenAI, chatComplete } from "@/lib/ai/openai-client";
import { consume, refund } from "@/lib/ai/usage-quota";
import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import {
  gatherConversations,
  messageText,
  sinceWindow,
  type ActionItem,
  type Ownership,
} from "@/lib/ai/conversation-gather";
import { NextRequest, NextResponse } from "next/server";

const MAX_CONVERSATIONS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
  resetAt?: number;
}

interface CacheEntry {
  data: ActionItemsResponse;
  expiresAt: number;
}

// No intra-TTL rate limit (unlike /tldr); the 10-minute cache TTL is the primary cost gate.
const cache = new Map<string, CacheEntry>();

/** Shape the model returns via tool-use — indices reference the transcript. */
interface RawItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  conversationIndex: number;
  messageIndex: number | null;
}

const ACTION_ITEMS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string", description: "The action, phrased imperatively and concisely." },
          owner: { type: ["string", "null"], description: "Display name of who owns it, or null." },
          ownership: {
            type: "string",
            enum: ["you", "waiting", "team"],
            description:
              "'you' = the current user must do it; 'waiting' = the user is blocked on / delegated it to someone else; 'team' = a general task with no clear owner.",
          },
          conversationIndex: { type: "integer", description: "Index of the [Conversation N] header." },
          messageIndex: { type: ["integer", "null"], description: "Index of the source message [N], or null." },
        },
        required: ["task", "owner", "ownership", "conversationIndex", "messageIndex"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getOpenAI()) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set OPENAI_API_KEY in Vercel env to enable AI action items.",
    } satisfies ActionItemsResponse);
  }

  const windowParam = request.nextUrl.searchParams.get("window") ?? "24h";
  const sinceDate = sinceWindow(windowParam);
  const sinceIso = sinceDate.toISOString();

  const client = getGraphClient(session.accessToken);

  let meId = "";
  let meName = "";
  try {
    const me = (await client.api("/me").select("id,displayName").get()) as MSUser;
    meId = me.id;
    meName = me.displayName ?? "the current user";
  } catch (err) {
    console.error("[api/ai/action-items] /me failed:", err);
    return NextResponse.json(
      { status: "error", cached: false, message: "Could not resolve current user" } satisfies ActionItemsResponse,
      { status: 502 }
    );
  }

  const cacheKey = `${meId}::${windowParam}::${sinceIso.slice(0, 13)}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ ...hit.data, cached: true } satisfies ActionItemsResponse);
  }

  const conversations = await gatherConversations(client, sinceDate);
  conversations.sort((a, b) => b.count - a.count);
  const top = conversations.slice(0, MAX_CONVERSATIONS);

  if (top.length === 0) {
    const empty: ActionItemsResponse = {
      status: "ok",
      cached: false,
      generatedAt: new Date().toISOString(),
      since: sinceIso,
      items: [],
    };
    cache.set(cacheKey, { data: empty, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json(empty);
  }

  const transcript = top
    .map((conv, ci) => {
      const lines = conv.messages
        .map((m, mi) => `  [${mi}] ${m.from?.user?.displayName ?? "Unknown"}: ${messageText(m)}`)
        .join("\n");
      return `[Conversation ${ci}] ${conv.label}\n${lines}`;
    })
    .join("\n\n");

  const quota = await consume(session.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        status: "rate_limited",
        cached: false,
        message: "You've reached today's AI limit.",
        resetAt: quota.resetAt,
      } satisfies ActionItemsResponse,
      { status: 429 }
    );
  }

  let raw: RawItem[] = [];
  try {
    const openai = getOpenAI()!;
    const completion = await chatComplete(
      openai,
      [
        {
          role: "user",
          content: `You extract concrete action items from Microsoft Teams conversations for ${meName} (user id ${meId}).

Rules:
- Only real, actionable tasks: asks, todos, commitments, blockers, follow-ups. Ignore small talk, FYIs, and resolved items.
- Set ownership relative to ${meName}: "you" if ${meName} must do it; "waiting" if ${meName} is waiting on or delegated it to someone else; "team" if it's a general task with no clear single owner.
- Set owner to the responsible person's display name when clear, else null.
- Reference the source with conversationIndex (the [Conversation N] header) and messageIndex (the [N] within that conversation). Use the message that best represents the task; null messageIndex if none fits.
- If there are no action items, return an empty items array.

Conversations:

${transcript}`,
        },
      ],
      {
        maxTokens: 2500,
        responseFormat: {
          type: "json_schema",
          json_schema: { name: "action_items", strict: true, schema: ACTION_ITEMS_SCHEMA as unknown as Record<string, unknown> },
        },
      }
    );
    const content = completion.choices[0]?.message?.content;
    const parsed = content ? (JSON.parse(content) as { items?: RawItem[] }) : undefined;
    raw = Array.isArray(parsed?.items) ? parsed!.items : [];
  } catch (err) {
    console.error("[api/ai/action-items] OpenAI request failed:", err);
    await refund(session.userId);
    return NextResponse.json(
      { status: "error", cached: false, message: "AI extraction failed" } satisfies ActionItemsResponse,
      { status: 502 }
    );
  }

  const items: ActionItem[] = raw
    .filter((r) => r && typeof r.task === "string" && r.task.trim().length > 0)
    .map((r) => {
      const conv = top[r.conversationIndex];
      if (!conv) return null;
      const msg =
        r.messageIndex != null &&
        Number.isInteger(r.messageIndex) &&
        r.messageIndex >= 0 &&
        r.messageIndex < conv.messages.length
          ? conv.messages[r.messageIndex]
          : undefined;
      const ownership: Ownership =
        r.ownership === "you" || r.ownership === "waiting" || r.ownership === "team" ? r.ownership : "team";
      return {
        task: r.task.trim(),
        owner: typeof r.owner === "string" && r.owner.trim() ? r.owner.trim() : null,
        ownership,
        sourceLabel: conv.label,
        contextId: conv.contextId,
        contextKind: conv.contextKind,
        messageId: msg?.id ?? null,
      } satisfies ActionItem;
    })
    .filter((x): x is ActionItem => x !== null);

  const data: ActionItemsResponse = {
    status: "ok",
    cached: false,
    generatedAt: new Date().toISOString(),
    since: sinceIso,
    items,
  };
  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });
  return NextResponse.json(data);
}
