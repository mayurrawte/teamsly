import { getOpenAI, chatComplete } from "@/lib/ai/openai-client";
import { consume, refund } from "@/lib/ai/usage-quota";
import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextRequest, NextResponse } from "next/server";
import { gatherConversations, messageText, sinceWindow, type ConvBundle } from "@/lib/ai/conversation-gather";

const MAX_CONVERSATIONS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_MS = 60 * 1000;

interface CacheEntry {
  data: TldrResponse;
  expiresAt: number;
  generatedAt: number;
}

interface TldrResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  conversationCount?: number;
  cached: boolean;
  digest?: string;
  message?: string;
  resetAt?: number;
}

const cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getOpenAI()) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set OPENAI_API_KEY in Vercel env to enable AI digests.",
    } satisfies TldrResponse);
  }

  const searchParams = request.nextUrl.searchParams;
  const windowParam = searchParams.get("window") ?? "24h";
  const sinceDate = searchParams.get("since") ? new Date(searchParams.get("since")!) : sinceWindow(windowParam);
  const sinceIso = sinceDate.toISOString();

  const accessToken = session.accessToken;
  const client = getGraphClient(accessToken);

  let meId = "";
  let meName = "";
  try {
    const me = (await client.api("/me").select("id,displayName").get()) as MSUser;
    meId = me.id;
    meName = me.displayName ?? "the user";
  } catch (err) {
    console.error("[api/ai/tldr] /me failed:", err);
    return NextResponse.json(
      { status: "error", cached: false, message: "Could not resolve current user" },
      { status: 502 }
    );
  }

  const cacheKey = `${meId}::${sinceIso.slice(0, 13)}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);

  if (hit && hit.expiresAt > now) {
    const withinRateWindow = now - hit.generatedAt < RATE_LIMIT_MS;
    if (withinRateWindow || hit.expiresAt > now) {
      return NextResponse.json({ ...hit.data, cached: true } satisfies TldrResponse);
    }
  }

  const conversations: ConvBundle[] = await gatherConversations(client, sinceDate);

  conversations.sort((a, b) => b.count - a.count);
  const top = conversations.slice(0, MAX_CONVERSATIONS);

  if (top.length === 0) {
    const emptyResponse: TldrResponse = {
      status: "ok",
      cached: false,
      generatedAt: new Date().toISOString(),
      since: sinceIso,
      conversationCount: 0,
      digest: "",
    };
    cache.set(cacheKey, { data: emptyResponse, expiresAt: now + CACHE_TTL_MS, generatedAt: now });
    return NextResponse.json(emptyResponse);
  }

  const transcript = top
    .map((conv) => {
      const lines = conv.messages
        .map((m) => {
          const name = m.from?.user?.displayName ?? "Unknown";
          return `${name}: ${messageText(m)}`;
        })
        .join("\n");
      return `## ${conv.label} (${conv.count} new messages)\n${lines}`;
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
      } satisfies TldrResponse,
      { status: 429 }
    );
  }

  let digest = "";
  try {
    const openai = getOpenAI()!;
    const completion = await chatComplete(
      openai,
      [
        {
          role: "user",
          content: `You are a chat catch-up assistant. The user has been away. Summarize the conversations below into a digest. For each conversation that has actionable content, output:
  - Topic: 1-line synthesis.
  - Decisions: list of any decisions made.
  - Action items: list of any todos / asks / blockers, with @mentions if attributable.
  - Mentions of ${meName}: list any direct mentions or things requiring their attention.
Skip conversations with no substantive content (small talk only).
Be concise. Use markdown. No preamble.

${transcript}`,
        },
      ],
      { maxTokens: 1800 }
    );
    digest = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[api/ai/tldr] OpenAI request failed:", err);
    await refund(session.userId);
    return NextResponse.json(
      { status: "error", cached: false, message: "AI digest generation failed" } satisfies TldrResponse,
      { status: 502 }
    );
  }

  const responseData: TldrResponse = {
    status: "ok",
    cached: false,
    generatedAt: new Date().toISOString(),
    since: sinceIso,
    conversationCount: top.length,
    digest,
  };

  cache.set(cacheKey, { data: responseData, expiresAt: now + CACHE_TTL_MS, generatedAt: now });

  return NextResponse.json(responseData);
}
