"use client";

import { format } from "date-fns";
import { Avatar } from "@/components/ui/Avatar";
import { AttachmentCard } from "./AttachmentCard";
import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { AddReactionPill, ReactionPill } from "./ReactionPill";
import { formatMessageTime, formatFullTimestamp } from "@/lib/utils/dates";
import { messagePlainText, renderMessageBody } from "@/lib/utils/render-message";
import type { ReactionType } from "@/lib/utils/reactions";

interface Props {
  message: MSMessage;
  isGroupHead?: boolean;
  onReplyInThread?: (message: MSMessage) => void;
  onToggleReaction?: (messageId: string, reactionType: ReactionType) => void;
}

export function MessageItem({ message, isGroupHead = true, onReplyInThread, onToggleReaction }: Props) {
  if (message.deletedDateTime) return null;

  const author = message.from?.user?.displayName ?? "Unknown";
  const userId = message.from?.user?.id ?? author;
  const content = messagePlainText(message.body.content, message.body.contentType);

  if (!content.trim()) return null;

  if (!isGroupHead) {
    const shortTime = format(new Date(message.createdDateTime), "h:mm");
    return (
      <div className="group relative px-4 py-[2px] pl-[72px] transition-colors duration-[80ms] ease-out hover:bg-[#27292d]">
        <MessageHoverToolbar
          messageId={message.id}
          onReact={onToggleReaction}
          onReplyInThread={() => onReplyInThread?.(message)}
        />
        <span
          className="pointer-events-none absolute left-4 top-[3px] w-9 select-none text-right text-[11px] leading-[18px] text-[#6c6f75] opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          title={formatFullTimestamp(message.createdDateTime)}
        >
          {shortTime}
        </span>
        <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.46668] text-[#d1d2d3]">
          {renderMessageBody(message.body.content, message.body.contentType)}
        </div>
        <Attachments attachments={message.attachments} />
        <ReactionsRow
          messageId={message.id}
          reactions={message.reactions ?? []}
          onToggleReaction={onToggleReaction}
        />
      </div>
    );
  }

  return (
    <div className="group relative flex gap-2 px-4 pb-[2px] pt-2 transition-colors duration-[80ms] ease-out hover:bg-[#27292d]">
      <MessageHoverToolbar
        messageId={message.id}
        onReact={onToggleReaction}
        onReplyInThread={() => onReplyInThread?.(message)}
      />
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
        <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.46668] text-[#d1d2d3]">
          {renderMessageBody(message.body.content, message.body.contentType)}
        </div>
        <Attachments attachments={message.attachments} />
        <ReactionsRow
          messageId={message.id}
          reactions={message.reactions ?? []}
          onToggleReaction={onToggleReaction}
        />
      </div>
    </div>
  );
}

function Attachments({ attachments }: { attachments?: MSMessage["attachments"] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col">
      {attachments.map((attachment) => (
        <AttachmentCard key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

function ReactionsRow({
  messageId,
  reactions,
  onToggleReaction,
}: {
  messageId: string;
  reactions: NonNullable<MSMessage["reactions"]>;
  onToggleReaction?: (messageId: string, reactionType: ReactionType) => void;
}) {
  if (reactions.length === 0 && !onToggleReaction) return null;

  const grouped = reactions.reduce<Record<string, { count: number; active: boolean }>>((acc, reaction) => {
    const current = acc[reaction.reactionType] ?? { count: 0, active: false };
    acc[reaction.reactionType] = {
      count: current.count + 1,
      active: current.active || reaction.user.id === "you",
    };
    return acc;
  }, {});

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Object.entries(grouped).map(([reactionType, reaction]) => (
        <ReactionPill
          key={reactionType}
          reactionType={reactionType}
          count={reaction.count}
          active={reaction.active}
          onClick={() => onToggleReaction?.(messageId, reactionType as ReactionType)}
        />
      ))}
      {onToggleReaction && (
        <AddReactionPill onSelect={(reactionType) => onToggleReaction(messageId, reactionType)} />
      )}
    </div>
  );
}
