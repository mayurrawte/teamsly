import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_PRO !== "true") {
    return NextResponse.json({ error: "Pro features are disabled" }, { status: 404 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 503 });
  }

  const body = (await req.json()) as { messages?: Array<{ author: string; content: string }> };
  const messages = body.messages?.slice(-30) ?? [];
  if (messages.length === 0) return NextResponse.json({ summary: "No unread messages to summarize." });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const transcript = messages.map((message) => `${message.author}: ${message.content}`).join("\n");
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 220,
    messages: [
      {
        role: "user",
        content: `Summarize these Microsoft Teams messages as a concise unread summary. Use 2 bullets and include blockers or decisions if present.\n\n${transcript}`,
      },
    ],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  return NextResponse.json({ summary: text });
}
