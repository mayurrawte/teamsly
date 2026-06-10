import { auth } from "@/lib/auth/config";
import { getOpenAI, chatComplete } from "@/lib/ai/openai-client";
import { consume, refund } from "@/lib/ai/usage-quota";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  summary: string;
  expiresAt: number;
}

// Content-hash cache: AiSummaryBanner fires this automatically on every
// conversation view, so without a cache, browsing would exhaust the daily
// quota. Identical message sets reuse the summary (and don't re-consume).
const cache = new Map<string, CacheEntry>();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getOpenAI()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  const body = (await req.json()) as { messages?: Array<{ author: string; content: string }> };
  const messages = body.messages?.slice(-30) ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ summary: "No unread messages to summarize." });
  }

  const transcript = messages.map((m) => `${m.author}: ${m.content}`).join("\n");
  const cacheKey = createHash("sha256").update(transcript).digest("hex");

  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ summary: hit.summary });
  }

  const quota = await consume(session.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Daily AI limit reached", resetAt: quota.resetAt },
      { status: 429 }
    );
  }

  const client = getOpenAI()!;
  let text = "";
  try {
    const completion = await chatComplete(
      client,
      [
        {
          role: "user",
          content: `Summarize these Microsoft Teams messages as a concise unread summary. Use 2 bullets and include blockers or decisions if present.\n\n${transcript}`,
        },
      ],
      { maxTokens: 400 }
    );
    text = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[api/ai/summary] OpenAI request failed:", err);
    await refund(session.userId);
    return NextResponse.json({ error: "AI summary failed" }, { status: 502 });
  }

  cache.set(cacheKey, { summary: text, expiresAt: now + CACHE_TTL_MS });
  return NextResponse.json({ summary: text });
}
