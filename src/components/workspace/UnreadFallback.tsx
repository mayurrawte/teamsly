"use client";

import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { getChatLabel } from "@/lib/utils/chat-label";
import { HomeTips } from "./HomeTips";

interface UnreadItem {
  id: string;
  name: string;
  href: string;
  count: number;
  kind: "dm" | "channel";
}

export function UnreadFallback() {
  const router = useRouter();
  const { chats, channels, unreadCounts, currentUserId, markRead } = useWorkspaceStore();

  const items: UnreadItem[] = [];
  for (const chat of chats) {
    const count = unreadCounts[chat.id] ?? 0;
    if (count > 0) {
      items.push({
        id: chat.id,
        name: getChatLabel(chat, currentUserId ?? ""),
        href: `/workspace/dm/${chat.id}`,
        count,
        kind: "dm",
      });
    }
  }
  for (const [teamId, list] of Object.entries(channels)) {
    for (const ch of list) {
      const count = unreadCounts[ch.id] ?? 0;
      if (count > 0) {
        items.push({
          id: ch.id,
          name: ch.displayName,
          href: `/workspace/t/${teamId}/${ch.id}`,
          count,
          kind: "channel",
        });
      }
    }
  }
  items.sort((a, b) => b.count - a.count);

  function open(item: UnreadItem) {
    markRead(item.id);
    router.push(item.href);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 py-2">
        <p className="text-[15px] font-medium text-[var(--text-primary)]">✨ You&apos;re all caught up</p>
        <div className="w-full max-w-md">
          <HomeTips />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Unread across {items.length} conversation{items.length === 1 ? "" : "s"}
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              {item.kind === "channel" && <Hash className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />}
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-primary)]">
                {item.name}
              </span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-white">
                {item.count > 99 ? "99+" : item.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
