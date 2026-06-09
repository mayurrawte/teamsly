import Anthropic from "@anthropic-ai/sdk";
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
  status: "ok" | "not_configured" | "error";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
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

const ACTION_ITEMS_TOOL: Anthropic.Tool = {
  name: "report_action_items",
  description:
    "Report the action items extracted from the conversations. Reference each item's source by the integer indices shown in the transcript.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string", description: "The action, phrased imperatively and concisely." },
            owner: {
              type: ["string", "null"],
              description: "Display name of who owns it, or null if unassigned.",
            },
            ownership: {
              type: "string",
              enum: ["you", "waiting", "team"],
              description:
                "'you' = the current user must do it; 'waiting' = the current user is blocked on / delegated it to someone else; 'team' = a general team task with no clear owner.",
            },
            conversationIndex: {
              type: "integer",
              description: "Index of the conversation (the [Conversation N] header) the item came from.",
            },
            messageIndex: {
              type: ["integer", "null"],
              description: "Index of the specific source message within that conversation, or null.",
            },
          },
          required: ["task", "owner", "ownership", "conversationIndex", "messageIndex"],
        },
      },
    },
    required: ["items"],
  } satisfies Anthropic.Tool["input_schema"],
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set ANTHROPIC_API_KEY in Vercel env to enable AI action items.",
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

  let raw: RawItem[] = [];
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [ACTION_ITEMS_TOOL],
      tool_choice: { type: "tool", name: "report_action_items" },
      messages: [
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
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const input = toolUse?.input as { items?: RawItem[] } | undefined;
    raw = Array.isArray(input?.items) ? input!.items : [];
  } catch (err) {
    console.error("[api/ai/action-items] Anthropic request failed:", err);
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
