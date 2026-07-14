"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Hash, MessageSquare, Search, X } from "lucide-react";
import { formatMessageTime } from "@/lib/utils/dates";
import { getChatLabel } from "@/lib/utils/chat-label";
import { useWorkspaceStore } from "@/store/workspace";

/**
 * Origin metadata for the messages handed to SearchModal. Lets the modal pass
 * back where a matched message came from when the user picks it, so the
 * caller can navigate to the right chat/channel and anchor on the message.
 *
 * Today every caller hands SearchModal at most one context's worth of
 * messages, so a single origin per modal instance is sufficient. If we ever
 * search across multiple contexts at once, switch this to a per-message
 * origin map.
 */
export type SearchMessageOrigin =
  | { kind: "channel"; teamId: string; channelId: string }
  | { kind: "chat"; chatId: string };

export interface SearchPerson {
  id: string;
  displayName: string;
  email: string;
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  channels: MSChannel[];
  chats: MSChat[];
  messages: MSMessage[];
  messageGroupName?: string;
  messageOrigin?: SearchMessageOrigin;
  onSelectChannel?: (channelId: string) => void;
  onSelectChat?: (chatId: string) => void;
  onSelectMessage?: (message: MSMessage, origin: SearchMessageOrigin) => void;
  /** Picked an org-directory person (someone not already in a chat) → open/create a DM. */
  onSelectPerson?: (person: SearchPerson) => void;
}

export function SearchModal({
  open,
  onOpenChange,
  teamName,
  channels,
  chats,
  messages,
  messageGroupName = "Current view",
  messageOrigin,
  onSelectChannel,
  onSelectChat,
  onSelectMessage,
  onSelectPerson,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  // Debounced copy of `query`. Filtering keys off this so each keystroke
  // doesn't HTML-strip + lowercase every message in the current view — that
  // was the source of typing lag.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUserId = useWorkspaceStore((s) => s.currentUserId);
  const patchChatMembers = useWorkspaceStore((s) => s.patchChatMembers);
  const membersFetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const toFetch = chats.filter(
      (chat) =>
        (!chat.members || chat.members.length === 0) &&
        !membersFetchedRef.current.has(chat.id)
    );
    for (const chat of toFetch) {
      membersFetchedRef.current.add(chat.id);
      fetch(`/api/chats/${encodeURIComponent(chat.id)}/members`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((members: MSChatMember[]) => {
          if (members.length > 0) patchChatMembers(chat.id, members);
        })
        .catch(() => {
          membersFetchedRef.current.delete(chat.id);
        });
    }
  }, [open, chats, patchChatMembers]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 120);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Org-directory people search (finds users the current user has never chatted
  // with). Runs only when the modal is open and the query is at least 2 chars,
  // and is cancelled if the query changes mid-flight.
  const [people, setPeople] = useState<SearchPerson[]>([]);
  const trimmedQuery = debouncedQuery.trim();
  useEffect(() => {
    if (!open || trimmedQuery.length < 2 || !onSelectPerson) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/people?q=${encodeURIComponent(trimmedQuery)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: SearchPerson[]) => {
        if (!cancelled) setPeople(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, trimmedQuery, onSelectPerson]);

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return { channels: channels.slice(0, 6), chats: chats.slice(0, 6), messageGroups: [] };

    return {
      channels: channels.filter((channel) => channel.displayName.toLowerCase().includes(normalizedQuery)).slice(0, 8),
      chats: chats.filter((chat) => getChatLabel(chat, currentUserId).toLowerCase().includes(normalizedQuery)).slice(0, 8),
      // Only surface message-result hits when the caller wired a
      // `messageOrigin` — without it we can't navigate to the matched
      // message, so the row would be a dead button.
      messageGroups: messageOrigin
        ? [
            {
              name: messageGroupName,
              messages: messages
                .filter((message) => messageText(message).toLowerCase().includes(normalizedQuery))
                .slice(0, 12),
            },
          ].filter((group) => group.messages.length > 0)
        : [],
    };
  }, [channels, chats, currentUserId, messageGroupName, messageOrigin, messages, normalizedQuery]);

  const hasResults =
    results.channels.length > 0 ||
    results.chats.length > 0 ||
    people.length > 0 ||
    results.messageGroups.some((group) => group.messages.length > 0);

  function resetQuery() {
    setQuery("");
    setDebouncedQuery("");
  }

  function handleSelectChannel(channelId: string) {
    onOpenChange(false);
    resetQuery();
    onSelectChannel?.(channelId);
  }

  function handleSelectChat(chatId: string) {
    onOpenChange(false);
    resetQuery();
    onSelectChat?.(chatId);
  }

  function handleSelectMessage(message: MSMessage) {
    onOpenChange(false);
    resetQuery();
    if (messageOrigin) onSelectMessage?.(message, messageOrigin);
  }

  function handleSelectPerson(person: SearchPerson) {
    onOpenChange(false);
    resetQuery();
    onSelectPerson?.(person);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetQuery();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="search-modal-overlay fixed inset-0 z-[60] bg-[var(--modal-overlay)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="search-modal-content fixed top-1/2 z-[70] flex max-h-[70vh] w-[640px] max-w-[calc(100vw-var(--sidebar-offset)-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--modal-bg)] text-[var(--text-primary)] shadow-[0_16px_64px_rgba(0,0,0,0.6)] outline-none"
          style={{ left: "calc(50% + var(--sidebar-offset) / 2)" }}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center border-b border-[var(--border)]">
            <Search className="ml-5 h-5 w-5 flex-shrink-0 text-[var(--text-secondary)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels, DMs, messages…"
              className="h-[58px] min-w-0 flex-1 bg-transparent px-3 text-[18px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <kbd className="mr-3 hidden flex-shrink-0 items-center rounded border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] md:inline-flex">
              esc
            </kbd>
            <Dialog.Close
              aria-label="Close search"
              className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {!hasResults ? (
              <div className="px-3 py-10 text-center text-[13px] text-[var(--text-muted)]">
                No results for <span className="font-bold text-[var(--text-secondary)]">{query}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {results.messageGroups.map((group) => (
                  <ResultSection key={group.name} title={group.name}>
                    {group.messages.map((message) => (
                      <MessageResult
                        key={message.id}
                        message={message}
                        query={normalizedQuery}
                        teamName={teamName}
                        onSelect={() => handleSelectMessage(message)}
                      />
                    ))}
                  </ResultSection>
                ))}

                {results.channels.length > 0 && (
                  <ResultSection title="Channels">
                    {results.channels.map((channel) => (
                      <EntityResult
                        key={channel.id}
                        icon={<Hash size={14} />}
                        title={channel.displayName}
                        subtitle={teamName}
                        query={normalizedQuery}
                        onSelect={() => handleSelectChannel(channel.id)}
                      />
                    ))}
                  </ResultSection>
                )}

                {results.chats.length > 0 && (
                  <ResultSection title="Direct messages">
                    {results.chats.map((chat) => (
                      <EntityResult
                        key={chat.id}
                        icon={<MessageSquare size={14} />}
                        title={getChatLabel(chat, currentUserId)}
                        subtitle={chat.chatType === "group" ? "Group DM" : "Direct message"}
                        query={normalizedQuery}
                        onSelect={() => handleSelectChat(chat.id)}
                      />
                    ))}
                  </ResultSection>
                )}

                {people.length > 0 && (
                  <ResultSection title="People">
                    {people.map((person) => (
                      <PersonResult
                        key={person.id}
                        person={person}
                        query={normalizedQuery}
                        onSelect={() => handleSelectPerson(person)}
                      />
                    ))}
                  </ResultSection>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-3 pb-1 text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function MessageResult({ message, query, teamName, onSelect }: { message: MSMessage; query: string; teamName: string; onSelect: () => void }) {
  const author = message.from?.user?.displayName ?? "Unknown";
  const initials = author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full gap-2 rounded-md px-3 py-2 text-left transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
    >
      <div className="mt-[3px] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[var(--accent)] text-[10px] font-bold text-[var(--text-white)]">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-bold text-[var(--text-primary)]">{author}</span>
          <span className="truncate text-[var(--text-muted)]">
            {teamName} · {formatMessageTime(message.createdDateTime)}
          </span>
        </div>
        <p className="truncate text-[13px] text-[var(--text-secondary)]">{highlight(messageText(message), query)}</p>
      </div>
    </button>
  );
}

function PersonResult({
  person,
  query,
  onSelect,
}: {
  person: SearchPerson;
  query: string;
  onSelect: () => void;
}) {
  const initials = person.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[var(--text-white)]">
        {initials || "?"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-[var(--text-primary)]">
          {highlight(person.displayName, query)}
        </span>
        <span className="block truncate text-[12px] text-[var(--text-muted)]">
          {person.email ? `${person.email} · Start a chat` : "Start a chat"}
        </span>
      </span>
    </button>
  );
}

function EntityResult({
  icon,
  title,
  subtitle,
  query,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  query: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[var(--surface-raised)] text-[var(--text-secondary)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-[var(--text-primary)]">{highlight(title, query)}</span>
        <span className="block truncate text-[12px] text-[var(--text-muted)]">{subtitle}</span>
      </span>
    </button>
  );
}

function highlight(value: string, query: string): React.ReactNode {
  if (!query) return value;
  const index = value.toLowerCase().indexOf(query);
  if (index === -1) return value;

  return (
    <>
      {value.slice(0, index)}
      <span className="rounded-sm bg-[var(--accent)] px-[2px] text-[var(--text-white)]">{value.slice(index, index + query.length)}</span>
      {value.slice(index + query.length)}
    </>
  );
}

function messageText(message: MSMessage): string {
  return message.body.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
