"use client";

import { format } from "date-fns";
import { Avatar } from "@/components/ui/Avatar";
import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { formatMessageTime, formatFullTimestamp } from "@/lib/utils/dates";

interface Props {
  message: MSMessage;
  isGroupHead?: boolean;
}

export function MessageItem({ message, isGroupHead = true }: Props) {
  if (message.deletedDateTime) return null;

  const author = message.from?.user?.displayName ?? "Unknown";
  const userId = message.from?.user?.id ?? author;
  const content =
    message.body.contentType === "html"
      ? stripHtml(message.body.content)
      : message.body.content;

  if (!content.trim()) return null;

  if (!isGroupHead) {
    const shortTime = format(new Date(message.createdDateTime), "h:mm");
    return (
      <div className="group relative px-4 py-[2px] pl-[72px] hover:bg-[#27292d]">
        <MessageHoverToolbar messageId={message.id} />
        <span
          className="pointer-events-none absolute left-4 top-[3px] w-9 select-none text-right text-[11px] leading-[18px] text-[#6c6f75] opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          title={formatFullTimestamp(message.createdDateTime)}
        >
          {shortTime}
        </span>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.46668] text-[#d1d2d3]">
          {content}
        </p>
        {hasReactions(message) && <ReactionsRow reactions={message.reactions!} />}
      </div>
    );
  }

  return (
    <div className="group relative flex gap-2 px-4 pb-[2px] pt-2 hover:bg-[#27292d]">
      <MessageHoverToolbar messageId={message.id} />
      <Avatar userId={userId} displayName={author} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="cursor-pointer text-[15px] font-black text-[#d1d2d3] hover:underline">
            {author}
          </span>
          <span
            className="text-[12px] text-[#6c6f75]"
            title={formatFullTimestamp(message.createdDateTime)}
          >
            {formatMessageTime(message.createdDateTime)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.46668] text-[#d1d2d3]">
          {content}
        </p>
        {hasReactions(message) && <ReactionsRow reactions={message.reactions!} />}
      </div>
    </div>
  );
}

function hasReactions(message: MSMessage): boolean {
  return Boolean(message.reactions && message.reactions.length > 0);
}

function ReactionsRow({ reactions }: { reactions: NonNullable<MSMessage["reactions"]> }) {
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.reactionType] = (acc[r.reactionType] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Object.entries(grouped).map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-1 rounded-full border border-[#3f4144] bg-[#2c2d30] px-2 py-0.5 text-[13px] text-[#ababad]"
        >
          {emoji} {count}
        </span>
      ))}
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
