"use client";

import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/utils/dates";
import { getChatLabel, getFirstOtherMember } from "@/lib/utils/chat-label";
import { MessageSquare } from "lucide-react";

export default function DirectMessagesIndexPage() {
  const router = useRouter();
  const { chats, currentUserId, unreadCounts, setActiveChat, markRead } =
    useWorkspaceStore();

  function openChat(chatId: string) {
    markRead(chatId);
    setActiveChat(chatId);
    router.push(`/app/dm/${chatId}`);
  }

  if (chats.length === 0) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-[var(--content-bg)] px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-raised)]">
          <MessageSquare className="h-6 w-6 text-[var(--text-muted)]" />
        </div>
        <h1 className="mb-2 text-[17px] font-bold text-[var(--text-primary)]">
          No direct messages yet
        </h1>
        <p className="max-w-md text-sm text-[var(--text-muted)]">
          Start a conversation from Microsoft Teams and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[var(--content-bg)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-[17px] font-bold text-[var(--text-primary)]">
          Direct messages
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {chats.length} conversation{chats.length === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="flex-1 overflow-y-auto py-2">
        {chats.map((chat) => {
          const label = getChatLabel(chat, currentUserId ?? "");
          const other = getFirstOtherMember(chat, currentUserId ?? "");
          const unread = unreadCounts[chat.id] ?? 0;
          const otherId = other?.userId ?? other?.id;

          return (
            <li key={chat.id}>
              <button
                type="button"
                onClick={() => openChat(chat.id)}
                className="focus-ring flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-[var(--surface-hover)]"
              >
                <Avatar
                  displayName={other?.displayName ?? label}
                  userId={otherId ?? chat.id}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "truncate text-sm",
                        unread > 0
                          ? "font-bold text-[var(--text-primary)]"
                          : "text-[var(--text-primary)]"
                      )}
                    >
                      {label}
                    </span>
                    {chat.lastUpdatedDateTime && (
                      <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                        {formatMessageTime(chat.lastUpdatedDateTime)}
                      </span>
                    )}
                  </div>
                </div>
                {unread > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
