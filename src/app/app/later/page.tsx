"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar } from "@/components/ui/Avatar";
import { useBookmarksStore, type Bookmark } from "@/store/bookmarks";

// ---------------------------------------------------------------------------
// Saved Messages — replaces the stub that used to live here.
//
// Why this exists: "Saved Messages" was removed in New Teams and users miss
// it. The Bookmark button on the message hover toolbar (see
// MessageHoverToolbar) writes into `useBookmarksStore`, which is IDB-backed,
// so a saved item survives reloads.
//
// Routing back to the source message: bookmarks are keyed by `contextId` of
// the same shape used by the workspace store's per-context message map:
//   - `chatId`                                → `/app/dm/{chatId}`
//   - `${teamId}:${channelId}`                → `/app/t/{teamId}/{channelId}`
//   - `demo:${chatId}` / `demo:${channelId}`  → `/demo`
// We don't yet deep-link to the specific message — clicking just opens the
// containing context. That's the same depth as the old Teams Saved Messages.
// ---------------------------------------------------------------------------

function routeForBookmark(contextId: string): string {
  if (contextId.startsWith("demo:")) return "/demo";
  if (contextId.includes(":")) {
    const [teamId, channelId] = contextId.split(":");
    return `/app/t/${teamId}/${channelId}`;
  }
  return `/app/dm/${contextId}`;
}

export default function LaterPage() {
  const bookmarks = useBookmarksStore((s) => s.bookmarks);
  const removeBookmark = useBookmarksStore((s) => s.removeBookmark);

  // Sort newest-first defensively. The store already sorts but a stale
  // hydrated set could land out of order during a race; tiny cost.
  const sorted = useMemo(
    () => [...bookmarks].sort((a, b) => b.savedAt - a.savedAt),
    [bookmarks]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-[60px] flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
        <Clock className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Saved</h1>
        {sorted.length > 0 && (
          <span className="text-[12px] text-[var(--text-muted)]">
            {sorted.length} {sorted.length === 1 ? "message" : "messages"}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sorted.map((bookmark) => (
              <BookmarkRow
                key={`${bookmark.contextId}::${bookmark.messageId}`}
                bookmark={bookmark}
                onRemove={() => removeBookmark(bookmark.contextId, bookmark.messageId)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BookmarkRow({
  bookmark,
  onRemove,
}: {
  bookmark: Bookmark;
  onRemove: () => void;
}) {
  const href = routeForBookmark(bookmark.contextId);
  const when = formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true });

  return (
    <li className="group relative px-6 py-3 transition-colors hover:bg-[var(--message-hover-bg)]">
      <Link href={href} className="flex items-start gap-3 focus-ring">
        <Avatar userId={bookmark.senderName} displayName={bookmark.senderName} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
              {bookmark.senderName}
            </span>
            {bookmark.contextLabel && (
              <span className="truncate text-[12px] text-[var(--text-muted)]">
                in {bookmark.contextLabel}
              </span>
            )}
            <span className="ml-auto whitespace-nowrap text-[11px] text-[var(--text-muted)]">
              {when}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 break-words text-[13px] leading-[1.45] text-[var(--text-secondary)]">
            {bookmark.snippet || <em className="text-[var(--text-muted)]">(no text)</em>}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label={`Remove saved message from ${bookmark.senderName}`}
        onClick={(e) => {
          // Stop the click from bubbling up to the wrapping Link.
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-4 top-3 flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] opacity-0 transition-opacity duration-100 hover:bg-[var(--surface-hover)] hover:text-white focus-ring group-hover:opacity-100"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Clock className="h-10 w-10 text-[var(--text-muted)]" aria-hidden="true" />
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
        Nothing saved yet
      </h2>
      <p className="max-w-sm text-[13px] text-[var(--text-secondary)]">
        Hover a message and pick the bookmark icon to save it for later. Saved
        messages live on this device.
      </p>
    </div>
  );
}
