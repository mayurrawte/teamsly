"use client";

import { format } from "date-fns";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/profile/UserProfilePopover";
import { AttachmentCard, MessageReferenceCard, isMessageReference } from "./AttachmentCard";
import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { AddReactionPill, ReactionPill } from "./ReactionPill";
import { formatMessageTime, formatFullTimestamp } from "@/lib/utils/dates";
import { messagePlainText, renderMessageBody } from "@/lib/utils/render-message";
import type { ReactionType } from "@/lib/utils/reactions";
import { usePreferencesStore } from "@/store/preferences";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";

interface Props {
  message: MSMessage;
  isGroupHead?: boolean;
  onReplyInThread?: (message: MSMessage) => void;
  onToggleReaction?: (messageId: string, reactionType: ReactionType) => void;
}

export function MessageItem({ message, isGroupHead = true, onReplyInThread, onToggleReaction }: Props) {
  const density = usePreferencesStore((state) => state.density);

  if (message.deletedDateTime) return null;

  const author = message.from?.user?.displayName ?? "Unknown";
  const userId = message.from?.user?.id ?? author;
  const content = messagePlainText(message.body.content, message.body.contentType);

  const allAttachments = message.attachments ?? [];
  const referenceAttachments = allAttachments.filter((a) => isMessageReference(a.contentType));
  const otherAttachments = allAttachments.filter((a) => !isMessageReference(a.contentType));
  const hasBody = content.trim().length > 0;

  // Drop rows with no body, no reply quote, and no other attachments to render
  if (!hasBody && referenceAttachments.length === 0 && otherAttachments.length === 0) return null;

  if (!isGroupHead) {
    const shortTime = format(new Date(message.createdDateTime), "h:mm");
    return (
      <div
        className={cn(
          "group relative px-4 pl-[72px] transition-colors duration-[80ms] ease-out hover:bg-[var(--message-hover-bg)]",
          density === "compact" ? "py-0" : "py-[2px]"
        )}
      >
        <MessageHoverToolbar
          messageId={message.id}
          onReact={onToggleReaction}
          onReplyInThread={() => onReplyInThread?.(message)}
        />
        <span
          className="pointer-events-none absolute left-4 top-[3px] w-9 select-none text-right text-xs leading-[18px] text-[var(--text-muted)] opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          title={formatFullTimestamp(message.createdDateTime)}
        >
          {shortTime}
        </span>
        <MessageReferences attachments={referenceAttachments} />
        {hasBody && (
          <div className="message-body break-words text-[14px] leading-[1.5] text-[var(--text-primary)]">
            {renderMessageBody(message.body.content, message.body.contentType)}
          </div>
        )}
        <Attachments attachments={otherAttachments} />
        <ReactionsRow
          messageId={message.id}
          reactions={message.reactions ?? []}
          onToggleReaction={onToggleReaction}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex gap-2 px-4 transition-colors duration-[80ms] ease-out hover:bg-[var(--message-hover-bg)]",
        density === "compact" ? "pb-0 pt-1" : "pb-[2px] pt-2"
      )}
    >
      <MessageHoverToolbar
        messageId={message.id}
        onReact={onToggleReaction}
        onReplyInThread={() => onReplyInThread?.(message)}
      />
      <UserProfilePopover userId={userId} displayName={author}>
        <button type="button" className="h-9 w-9 flex-shrink-0 rounded text-left focus-ring">
          <Avatar userId={userId} displayName={author} size={36} />
        </button>
      </UserProfilePopover>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="cursor-pointer text-[14px] font-bold text-[var(--text-primary)] hover:underline">
            {author}
          </span>
          <span
            className="text-xs text-[var(--text-muted)]"
            title={formatFullTimestamp(message.createdDateTime)}
          >
            {formatMessageTime(message.createdDateTime)}
          </span>
        </div>
        <MessageReferences attachments={referenceAttachments} />
        {hasBody && (
          <div className="message-body break-words text-[14px] leading-[1.5] text-[var(--text-primary)]">
            {renderMessageBody(message.body.content, message.body.contentType)}
          </div>
        )}
        <Attachments attachments={otherAttachments} />
        <ReactionsRow
          messageId={message.id}
          reactions={message.reactions ?? []}
          onToggleReaction={onToggleReaction}
        />
      </div>
    </div>
  );
}

function MessageReferences({
  attachments,
}: {
  attachments: NonNullable<MSMessage["attachments"]>;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mb-1 flex flex-col">
      {attachments.map((attachment) => (
        <MessageReferenceCard key={attachment.id} attachment={attachment} />
      ))}
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
  const currentUserId = useWorkspaceStore((state) => state.currentUserId);

  if (reactions.length === 0) return null;

  const grouped = reactions.reduce<Record<string, { count: number; active: boolean }>>((acc, reaction) => {
    const current = acc[reaction.reactionType] ?? { count: 0, active: false };
    acc[reaction.reactionType] = {
      count: current.count + 1,
      active: current.active || reaction.user.id === currentUserId,
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
