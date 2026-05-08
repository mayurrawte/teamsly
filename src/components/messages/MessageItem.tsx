"use client";

import { formatDistanceToNow } from "date-fns";

interface Props {
  message: MSMessage;
}

export function MessageItem({ message }: Props) {
  if (message.deletedDateTime) return null;

  const author = message.from?.user?.displayName ?? "Unknown";
  const initials = author.slice(0, 2).toUpperCase();
  const time = formatDistanceToNow(new Date(message.createdDateTime), { addSuffix: true });
  const content =
    message.body.contentType === "html"
      ? stripHtml(message.body.content)
      : message.body.content;

  if (!content.trim()) return null;

  return (
    <div className="group mb-1 flex gap-3 rounded px-2 py-1.5 hover:bg-[#27292d]">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#1164a3] text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-white">{author}</span>
          <span className="text-[11px] text-[#6c6f75]">{time}</span>
        </div>
        <p className="mt-0.5 text-[15px] leading-relaxed text-[#d1d2d3]">{content}</p>
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex gap-1">
            {Object.entries(groupReactions(message.reactions)).map(([emoji, count]) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-1 rounded-full border border-[#3f4144] bg-[#2c2d30] px-2 py-0.5 text-xs text-[#ababad]"
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function groupReactions(reactions: MSMessage["reactions"]): Record<string, number> {
  return (reactions ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.reactionType] = (acc[r.reactionType] ?? 0) + 1;
    return acc;
  }, {});
}
