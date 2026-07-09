"use client";

import { format } from "date-fns";
import { memo, useState, useEffect, useRef, useMemo, type KeyboardEvent } from "react";
import { Clock, CheckCheck } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/profile/UserProfilePopover";
import { AttachmentCard, MessageReferenceCard, isMessageReference } from "./AttachmentCard";
import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { AddReactionPill, ReactionPill } from "./ReactionPill";
import { formatMessageTime, formatFullTimestamp } from "@/lib/utils/dates";
import { messagePlainText, renderMessageBody } from "@/lib/utils/render-message";
import { isDisappearing, unwrapMessage } from "@/lib/utils/disappear";
import { isPoll, parsePoll } from "@/lib/polls";
import { PollCard } from "./PollCard";
import { reactionsSignature, type ReactionType } from "@/lib/utils/reactions";
import { useWorkspaceStore } from "@/store/workspace";
import { useBookmarksStore } from "@/store/bookmarks";
import { cn } from "@/lib/utils";
import { detectGitHubLinks } from "@/lib/integrations/github-detect";
import { GitHubCard } from "./GitHubCard";
import { detectRichLinks } from "@/lib/integrations/link-detect";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { useQuickReact } from "@/hooks/useQuickReact";

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
   * Human-readable label for where the message lives, shown in `/workspace/later`.
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
  /**
   * Called when a disappearing message's timer reaches zero so the parent
   * can remove it from its store. Fired for both own and received messages.
   * For received messages this is local-only removal (sender handles Graph DELETE).
   */
  onExpire?: (messageId: string) => void;
}

function DisappearBadge({ disappearAt }: { disappearAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, disappearAt - now);
  const secs = Math.ceil(remaining / 1000);
  const text = secs >= 3600 ? `${Math.ceil(secs / 3600)}h`
    : secs >= 60 ? `${Math.ceil(secs / 60)}m`
    : `${secs}s`;
  return (
    <span
      title="This message will disappear"
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--bg-elevated,#2a2d31)] px-2 py-[1px] text-[11px] text-[var(--text-secondary,#ababad)]"
    >
      ⏱ {text}
    </span>
  );
}

function MessageItemImpl({
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
  onExpire,
}: Props) {
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
  // to bookmark against until the server assigns a real id. Disappearing
  // messages can't be saved either: the bookmark would capture the opaque
  // blob, and saving defeats the point of an ephemeral message.
  const canSave = Boolean(
    contextId &&
      !message.__pending &&
      !message.__failed &&
      !isDisappearing(message.body.content)
  );

  // Quick-react: hover this row and press 1–6 to react. Suppress while
  // editing so the keystrokes go to the textarea, and on optimistic/failed
  // messages where there's no stable id to react against.
  const quickReact = useQuickReact({
    onReact: onToggleReaction ? (rt) => onToggleReaction(message.id, rt) : undefined,
    disabled: isEditing || Boolean(message.__pending || message.__failed),
  });

  // Animate messages that just arrived (within the last 3s) or are optimistic
  // sends. This covers real-time inbound messages and the user's own pending
  // messages without needing an extra prop from the feed.
  const isNew =
    message.__pending ||
    Date.now() - new Date(message.createdDateTime).getTime() < 3000;
  // Density vars drive padding via inline style so the density preset is the
  // single source of truth — no more 2-branch ternary that ignores "cozy".
  // The group-head row (`isGroupHead`) gets extra top spacing so groups
  // separate visually; the continuation row keeps padding symmetric.
  const densityRowStyle: React.CSSProperties = isGroupHead
    ? {
        paddingTop: "calc(var(--density-row-py) * 2 + 2px)",
        paddingBottom: "var(--density-row-py)",
      }
    : {
        paddingTop: "var(--density-row-py)",
        paddingBottom: "var(--density-row-py)",
      };
  const animationStyle: React.CSSProperties = {
    ...densityRowStyle,
    ...(isNew
      ? { animation: "message-in var(--motion-base) var(--ease-out-soft) both" }
      : {}),
  };
  // Density-driven body typography for the message-body div. Kept separate
  // so the row chrome stays themable independently from text rendering.
  const bodyDensityStyle: React.CSSProperties = {
    fontSize: "var(--density-message-font-size)",
    lineHeight: "var(--density-message-line-height)",
  };

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

  const rawContent = message.body.content;
  const disappearing = isDisappearing(rawContent);
  // Polls render as an interactive card in place of the body; their reactions
  // are the votes, so the normal reaction row is suppressed for them.
  const poll = !disappearing && isPoll(rawContent) ? parsePoll(rawContent) : null;
  const [decoded, setDecoded] = useState<{ body: string; disappearAt: number } | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  // true once the disappear timer fires — hides the row immediately
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!disappearing || !contextId) return;
    let cancelled = false;
    unwrapMessage(contextId, rawContent).then((res) => {
      if (cancelled) return;
      if (res) setDecoded(res);
      else setDecodeFailed(true);
    });
    return () => { cancelled = true; };
  }, [disappearing, contextId, rawContent]);

  // Fire a timer so the message vanishes from the UI exactly when it expires.
  // Works for both sent (own) and received messages — the parent's onExpire
  // callback removes it from the store; the sweep in ChatView handles the
  // Graph DELETE for sent messages separately.
  useEffect(() => {
    if (!decoded) return;
    const remaining = decoded.disappearAt - Date.now();
    if (remaining <= 0) {
      setExpired(true);
      return;
    }
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [decoded]);

  useEffect(() => {
    if (!expired) return;
    onExpire?.(message.id);
  // onExpire intentionally omitted — stable callback ref, avoid spurious fires
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, message.id]);

  // Hoist content + detection above early returns so hooks are always called
  // unconditionally (React rules of hooks).
  const content = messagePlainText(message.body.content, message.body.contentType);
  const detection = useMemo(
    () => ({
      github: detectGitHubLinks(content),
      richLinks: detectRichLinks(content),
    }),
    [content, message.id]
  );

  if (message.deletedDateTime) return null;
  if (expired) return null;

  const author = message.from?.user?.displayName ?? "Unknown";
  const userId = message.from?.user?.id ?? author;
  // Pending/failed messages are always the current user's own (authored locally).
  const isOwn = message.from?.user?.id === currentUserId;
  // Only expose delete/edit callbacks for the current user's own messages.
  // Pending/failed messages suppress the full toolbar — retry/discard shown instead.
  const deleteHandler = isOwn && !message.__pending && !message.__failed ? onDelete : undefined;
  const editHandler = isOwn && !message.__pending && !message.__failed ? onEdit : undefined;

  const pollVotingDisabled = Boolean(message.__pending || message.__failed) || !onToggleReaction;
  // Single-choice voting: toggling an option you've already picked clears it;
  // picking a new one first clears any other option you'd voted, then sets it.
  const handlePollVote = (reactionType: ReactionType) => {
    if (!poll || !onToggleReaction) return;
    const reactions = message.reactions ?? [];
    const votedOption = (opt: { reactionType: ReactionType; emoji: string }) =>
      reactions.some(
        (r) => r.user.id === currentUserId && (r.reactionType === opt.reactionType || r.reactionType === opt.emoji),
      );
    const chosen = poll.options.find((o) => o.reactionType === reactionType);
    if (!chosen) return;
    if (votedOption(chosen)) {
      onToggleReaction(message.id, reactionType); // toggle this choice off
      return;
    }
    for (const opt of poll.options) {
      if (opt.reactionType !== reactionType && votedOption(opt)) {
        onToggleReaction(message.id, opt.reactionType); // clear the previous choice
      }
    }
    onToggleReaction(message.id, reactionType); // set the new choice
  };

  const allAttachments = message.attachments ?? [];
  const referenceAttachments = allAttachments.filter((a) => isMessageReference(a.contentType));
  const otherAttachments = allAttachments.filter((a) => !isMessageReference(a.contentType));
  const hasBody = content.trim().length > 0;

  // Drop rows with no body, no reply quote, and no other attachments to render
  if (!hasBody && referenceAttachments.length === 0 && otherAttachments.length === 0) return null;

  // Slash-command result heuristic: messages starting with a result emoji that arrived
  // in the last 10 s get a pop-in animation. Capped to recent messages to avoid
  // animating historical slash results in the backlog.
  const SLASH_RESULT_EMOJIS = ["🪙", "🎲", "🎯", "🎱", "🃏", "✏️", "🗓️"];
  const isRecentSlashResult =
    isNew &&
    Date.now() - new Date(message.createdDateTime).getTime() < 10000 &&
    SLASH_RESULT_EMOJIS.some((e) => content.trimStart().startsWith(e));

  // Inline retry/discard row for failed optimistic messages.
  const failedBanner = message.__failed ? (
    <div className="mt-1 flex items-center gap-3">
      <span className="text-[12px] text-red-400">Failed to send</span>
      {onRetry && (message.__originalText ?? content) && (
        <button
          type="button"
          onClick={() => onRetry(message.__originalText ?? content)}
          className="rounded px-2 py-1 text-[12px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface-hover)] focus-ring"
        >
          Retry
        </button>
      )}
      {onDiscard && (
        <button
          type="button"
          onClick={() => onDiscard(message.id)}
          className="rounded px-2 py-1 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] focus-ring"
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
        style={animationStyle}
        onMouseEnter={quickReact.onMouseEnter}
        onMouseLeave={quickReact.onMouseLeave}
        className={cn(
          "group relative flex px-4 transition-colors duration-[80ms] ease-out hover:bg-[var(--message-hover-bg)]",
          message.__pending && "opacity-60",
          message.__failed && "border-l-2 border-red-500/60"
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
        {/* Gutter width = head row's avatar column: 32px avatar + gap-2 (8px) = 40px,
            so continuation text aligns pixel-for-pixel under the group head's body. */}
        <span
          className="flex w-10 flex-shrink-0 select-none items-start justify-end gap-0.5 pr-2 pt-[3px] text-right text-[11px] tabular-nums leading-[18px] text-[var(--text-muted)] opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          title={formatFullTimestamp(message.createdDateTime)}
        >
          {message.__pending && (
            <Clock size={10} className="shrink-0 opacity-50" />
          )}
          {!message.__pending && !message.__failed && isOwn && (
            <CheckCheck size={10} className="shrink-0 opacity-40" />
          )}
          {shortTime}
        </span>
        <div className="min-w-0 flex-1">
          <MessageReferences attachments={referenceAttachments} />
          {isEditing ? (
            editingArea
          ) : poll ? (
            <PollCard
              poll={poll}
              message={message}
              currentUserId={currentUserId}
              onVote={handlePollVote}
              disabled={pollVotingDisabled}
            />
          ) : (
            hasBody && (
              <>
                <div
                  style={bodyDensityStyle}
                  className={`message-body break-words text-[var(--text-primary)]${isRecentSlashResult ? " slash-fx-pop" : ""}`}
                >
                  {disappearing
                    ? decoded
                      ? renderMessageBody(decoded.body, "text")
                      : decodeFailed
                        ? <span className="italic text-[var(--text-secondary,#ababad)]">🕓 Message not available here</span>
                        : <span className="italic text-[var(--text-secondary,#ababad)]">…</span>
                    : renderMessageBody(message.body.content, message.body.contentType)}
                  {disappearing && decoded && decoded.disappearAt > Date.now() && (
                    <DisappearBadge disappearAt={decoded.disappearAt} />
                  )}
                </div>
                <GitHubCards links={detection.github} />
                <RichLinkCards links={detection.richLinks} />
              </>
            )
          )}
          <Attachments attachments={otherAttachments} />
          {!poll && !message.__pending && !message.__failed && (
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

  return (
    <div
      data-message-id={message.id}
      style={animationStyle}
      onMouseEnter={quickReact.onMouseEnter}
      onMouseLeave={quickReact.onMouseLeave}
      className={cn(
        "group relative flex gap-2 px-4 transition-colors duration-[80ms] ease-out hover:bg-[var(--message-hover-bg)]",
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
        <button type="button" className="h-8 w-8 flex-shrink-0 rounded-full text-left focus-ring">
          <Avatar userId={userId} displayName={author} size={32} />
        </button>
      </UserProfilePopover>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="cursor-pointer text-[14px] font-semibold text-[var(--text-primary)] hover:underline">
            {author}
          </span>
          <span className="flex items-center gap-1">
            <span
              className="text-[11px] text-[var(--text-muted)]"
              title={formatFullTimestamp(message.createdDateTime)}
            >
              {formatMessageTime(message.createdDateTime)}
            </span>
            {message.__pending && (
              <Clock size={10} className="text-[var(--text-muted)] opacity-50" />
            )}
            {!message.__pending && !message.__failed && isOwn && (
              <CheckCheck size={10} className="text-[var(--text-muted)] opacity-40" />
            )}
          </span>
        </div>
        <MessageReferences attachments={referenceAttachments} />
        {isEditing ? (
          editingArea
        ) : poll ? (
          <PollCard
            poll={poll}
            message={message}
            currentUserId={currentUserId}
            onVote={handlePollVote}
            disabled={pollVotingDisabled}
          />
        ) : (
          hasBody && (
            <>
              <div style={bodyDensityStyle} className="message-body break-words text-[var(--text-primary)]">
                {disappearing
                  ? decoded
                    ? renderMessageBody(decoded.body, "text")
                    : decodeFailed
                      ? <span className="italic text-[var(--text-secondary,#ababad)]">🕓 Message not available here</span>
                      : <span className="italic text-[var(--text-secondary,#ababad)]">…</span>
                  : renderMessageBody(message.body.content, message.body.contentType)}
              </div>
              {disappearing && decoded && decoded.disappearAt > Date.now() && (
                <DisappearBadge disappearAt={decoded.disappearAt} />
              )}
              <GitHubCards links={detection.github} />
            </>
          )
        )}
        <Attachments attachments={otherAttachments} />
        {!poll && !message.__pending && !message.__failed && (
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

function GitHubCards({ links }: { links: ReturnType<typeof detectGitHubLinks> }) {
  if (links.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-2">
      {links.map((link) => <GitHubCard key={link.url} link={link} />)}
    </div>
  );
}

function RichLinkCards({ links }: { links: ReturnType<typeof detectRichLinks> }) {
  if (links.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-2">
      {links.map((link) => <LinkPreviewCard key={link.url} link={link} />)}
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

function attachmentSig(m: Props["message"]): string {
  return (m.attachments ?? []).map((x) => x.id).join(",");
}

function propsEqual(a: Props, b: Props): boolean {
  // Callback props are intentionally ignored: their behavior is row-independent,
  // so a new closure identity from the parent must not force a re-render.
  return (
    a.message.id === b.message.id &&
    a.message.lastModifiedDateTime === b.message.lastModifiedDateTime &&
    a.message.__pending === b.message.__pending &&
    a.message.__failed === b.message.__failed &&
    // A late-arriving attachment/card can change without bumping lastModified.
    attachmentSig(a.message) === attachmentSig(b.message) &&
    // Reactions can also change without a lastModifiedDateTime bump.
    reactionsSignature(a.message.reactions) === reactionsSignature(b.message.reactions) &&
    a.isGroupHead === b.isGroupHead &&
    a.contextId === b.contextId &&
    a.contextLabel === b.contextLabel
  );
}

export const MessageItem = memo(MessageItemImpl, propsEqual);
