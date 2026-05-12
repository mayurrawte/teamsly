"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { messagePlainText } from "@/lib/utils/render-message";

interface AiSummaryBannerProps {
  messages: MSMessage[];
}

export function AiSummaryBanner({ messages }: AiSummaryBannerProps) {
  const enabled = process.env.NEXT_PUBLIC_PRO === "true";
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const summaryInput = useMemo(
    () =>
      messages.slice(-30).map((message) => ({
        author: message.from?.user?.displayName ?? "Unknown",
        content: messagePlainText(message.body.content, message.body.contentType),
      })),
    [messages]
  );

  useEffect(() => {
    if (!enabled || messages.length < 10) return;

    let cancelled = false;
    setLoading(true);
    fetch("/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: summaryInput }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { summary?: string } | null) => {
        if (!cancelled) setSummary(data?.summary ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, messages.length, summaryInput]);

  if (!enabled || messages.length < 10) return null;

  return (
    <div className="mx-4 mb-2 mt-3 rounded-md border border-[#3f4144] bg-[rgba(15,90,143,0.15)] px-3 py-2 text-[13px] text-[#d1d2d3]">
      <div className="mb-1 flex items-center gap-2 font-bold text-white">
        <Sparkles size={14} className="text-[#1d9bd1]" />
        AI unread summary
      </div>
      <p className="whitespace-pre-wrap text-[#ababad]">
        {loading ? "Summarizing unread messages..." : summary ?? "Summary unavailable."}
      </p>
    </div>
  );
}
