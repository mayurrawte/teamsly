"use client";

import { format } from "date-fns";
import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
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
import { useBookmarksStore } from "@/store/bookmarks";
import { cn } from "@/lib/utils";

interface Props {
  message: MSMessage;
  isGroupHead?: boolean;
  /**
   * Context key the parent feed lives in — same shape as the workspace
   * store's per-context message map (`chatId` or `${teamId}:${channelId}`,
   * or `demo:...` for the demo views). Used as part of the bookmark key.
   * When undefined, the save affordance is suppressed.
   */
  contextId?: string;
  /**
   * Human-readable label for where the message lives, shown in `/app/later`.
   * E.g. `#general` for a channel or the chat partner's display name for a DM.
   */
  contextLabel?: string;
  onReplyInThread?: (message: MSMessage) => void;
  onForward?: (message: MSMessage) => void;
  onToggleReaction?: (messageId: string, reactionType: ReactionType) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void> | void;
  onRetry?: (originalText: string) => void;
  onDiscard?: (messageId: string) => void;
}

export function MessageItem({
  message,
  isGroupHead = true,
  contextId,
  contextLabel,
  onReplyInThread,
  onForward,
  onToggleReaction,
  onDelete,
  onEdit,
  onRetry,
  onDiscard,
}: Props) {
  const density = usePreferencesStore((state) => state.density);
  const currentUserId = useWorkspaceStore((state) => state.currentUserId);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to the bookmarks store *only* for this message's saved state.
  // Selecting at the boolean level keeps every other message from re-rendering
  // when an unrelated bookmark changes.
  const isSaved = useBookmarksStore((s) =>
    contextId ? s.isSaved(contextId, message.id) : false
  );
  const addBookmark = useBookmarksStore((s) => s.addBookmark);
  const removeBookmark = useBookmarksStore((s) => s.removeBookmark);

  // Optimistic + pending messages can't be saved — there's nothing stable
  // to bookmark against until the server assigns a real id.
  const canSave = Boolean(
    contextId && !message.__pending && !message.__failed
  );

  const handleSaveToggle = canSave
    ? () => {
        if (!contextId) return;
        if (isSaved) {
          removeBookmark(contextId, message.id);
          return;
        }
        const plain = messagePlainText(message.body.content, message.body.contentType);
        addBookmark({
          contextId,
          messageId: message.id,
          savedAt: Date.now(),
          snippet: plain.slice(0, 200),
          senderName: message.from?.user?.displayName ?? "Unknown",
          contextLabel: contextLabel ?? "",
        });
      }
    : undefined;

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    }
  }, [isEditing]);

  if (message.deletedDateTime) return null;

  const author = message.from?.user?.displayName ?? "Unknown";
  const userId = message.from?.user?.id ?? author;
  // Pending/failed messages are always the current user's own (authored locally).
  const isOwn = message.from?.user?.id === currentUserId;
  // Only expose delete/edit callbacks for the current user's own messages.
  // Pending/failed messages suppress the full toolbar — retry/discard shown instead.
  const deleteHandler = isOwn && !message.__pending && !message.__failed ? onDelete : undefined;
  const editHandler = isOwn && !message.__pending && !message.__failed ? onEdit : undefined;
  const content = messagePlainText(message.body.content, message.body.contentType);

  const allAttachments = message.attachments ?? [];
  const referenceAttachments = allAttachments.filter((a) => isMessageReference(a.contentType));
  const otherAttachments = allAttachments.filter((a) => !isMessageReference(a.contentType));
  const hasBody = content.trim().length > 0;

  // Drop rows with no body, no reply quote, and no other attachments to render
  if (!hasBody && referenceAttachments.length === 0 && otherAttachments.length === 0) return null;

  // Inline retry/discard row for failed optimistic messages.
  const failedBanner = message.__failed ? (
    <div className="mt-1 flex items-center gap-3">
      <span className="text-[12px] text-red-400">Failed to send</span>
      {onRetry && (message.__originalText ?? content) && (
        <button
          type="button"
          onClick={() => onRetry(message.__originalText ?? content)}
          className="text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Retry
        </button>
      )}
      {onDiscard && (
        <button
          type="button"
          onClick={() => onDiscard(message.id)}
          className="text-[12px] font-medium text-[var(--text-muted)] hover:underline"
        >
          Discard
        </button>
      )}
    </div>
  ) : null;

  function startEditing() {
    setDraft(messagePlainText(message.body.content, message.body.contentType));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setDraft("");
  }

  async function saveEdit() {
    const trimmed = draft.trim();
    // Empty draft = treat as cancel, not delete
    if (!trimmed) {
      cancelEditing();
      return;
    }
    setIsEditing(false);
    await editHandler?.(message.id, trimmed);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
      return;
    }
    // Enter (no shift) or Cmd/Ctrl+Enter → save
    if (e.key === "Enter" && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit();
    }
  }

  const editingArea = (
    <div className="mt-1">
      <TextareaAutosize
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        maxRows={12}
        className="w-full resize-none rounded border border-[var(--border-input)] bg-[var(--surface)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--text-secondary)]"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={saveEdit}
          className="rounded bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:opacity-90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          className="rounded px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          Cancel
        </button>
        <span className="text-[11px] text-[var(--text-muted)]">
          Enter to save · Esc to cancel · empty to cancel
        </span>
      </div>
    </div>
  );

  if (!isGroupHead) {
    const shortTime = format(new Date(message.createdDateTime), "h:mm");
    return (
      <div
        data-message-id={message.id}
        className={cn(
          "group relative px-4 pl-[60px] transition-colors duration-[80ms] ease-out hover:bg-[var(--message-hover-bg)]",
          density === "compact" ? "py-0" : "py-[2px]",
          message.__pending && "opacity-60",
          message.__failed && "border-l-2 border-red-500/60 pl-2"
        )}
      >
        {!isEditing && !message.__pending && !message.__failed && (
          <MessageHoverToolbar
            messageId={message.id}
            onReact={onToggleReaction}
            onReplyInThread={() => onReplyInThread?.(message)}
            onForward={onForward ? () => onForward(message) : undefined}
            onSave={handleSaveToggle}
            isSaved={isSaved}
            onEdit={editHandler ? startEditing : undefined}
            onDelete={deleteHandler}
          />
        )}
        <span
          className="pointer-events-none absolute left-4 top-[3px] w-10 select-none text-right text-xs leading-[18px] text-[var(--text-muted)] opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          title={formatFullTimestamp(message.createdDateTime)}
        >
          {shortTime}
        </span>
        <MessageReferences attachments={referenceAttachments} />
        {isEditing ? (
          editingArea
        ) : (
          hasBody && (
            <div className="message-body break-words text-[14px] leading-[1.5] text-[var(--text-primary)]">
              {renderMessageBody(message.body.content, message.body.contentType)}
            </div>
          )
        )}
        <Attachments attachments={otherAttachments} />
        {!message.__pending && !message.__failed && (
          <ReactionsRow
            messageId={message.id}
            reactions={message.reactions ?? []}
            onToggleReaction={onToggleReaction}
          />
        )}
        {failedBanner}
      </div>
    );
  }

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group relative flex gap-2 px-4 transition-colors duration-[80ms] ease-out hover:bg-[var(--message-hover-bg)]",
        density === "compact" ? "pb-0 pt-1" : "pb-[2px] pt-2",
        message.__pending && "opacity-60",
        message.__failed && "border-l-2 border-red-500/60 pl-2"
      )}
    >
      {!isEditing && !message.__pending && !message.__failed && (
        <MessageHoverToolbar
          messageId={message.id}
          onReact={onToggleReaction}
          onReplyInThread={() => onReplyInThread?.(message)}
          onForward={onForward ? () => onForward(message) : undefined}
          onEdit={editHandler ? startEditing : undefined}
          onDelete={deleteHandler}
        />
      )}
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
        {isEditing ? (
          editingArea
        ) : (
          hasBody && (
            <div className="message-body break-words text-[14px] leading-[1.5] text-[var(--text-primary)]">
              {renderMessageBody(message.body.content, message.body.contentType)}
            </div>
          )
        )}
        <Attachments attachments={otherAttachments} />
        {!message.__pending && !message.__failed && (
          <ReactionsRow
            messageId={message.id}
            reactions={message.reactions ?? []}
            onToggleReaction={onToggleReaction}
          />
        )}
        {failedBanner}
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
