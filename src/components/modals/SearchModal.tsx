"use client";

import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Hash, MessageSquare, Search, X } from "lucide-react";
import { formatMessageTime } from "@/lib/utils/dates";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  channels: MSChannel[];
  chats: MSChat[];
  messages: MSMessage[];
}

export function SearchModal({
  open,
  onOpenChange,
  teamName,
  channels,
  chats,
  messages,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return { channels: channels.slice(0, 6), chats: chats.slice(0, 6), messages: [] };

    return {
      channels: channels.filter((channel) => channel.displayName.toLowerCase().includes(normalizedQuery)).slice(0, 8),
      chats: chats.filter((chat) => chatLabel(chat).toLowerCase().includes(normalizedQuery)).slice(0, 8),
      messages: messages
        .filter((message) => messageText(message).toLowerCase().includes(normalizedQuery))
        .slice(0, 12),
    };
  }, [channels, chats, messages, normalizedQuery]);

  const hasResults = results.channels.length > 0 || results.chats.length > 0 || results.messages.length > 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="search-modal-overlay fixed inset-0 z-[60] bg-[rgba(0,0,0,0.7)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="search-modal-content fixed left-1/2 top-1/2 z-[70] flex max-h-[70vh] w-[640px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#3f4144] bg-[#1a1d21] text-[#d1d2d3] shadow-[0_16px_64px_rgba(0,0,0,0.6)] outline-none"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center border-b border-[#3f4144]">
            <Search className="ml-5 h-5 w-5 flex-shrink-0 text-[#ababad]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="h-[58px] min-w-0 flex-1 bg-transparent px-3 text-[18px] text-[#d1d2d3] outline-none placeholder:text-[#6c6f75]"
            />
            <Dialog.Close
              aria-label="Close search"
              className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {!hasResults ? (
              <div className="px-3 py-10 text-center text-[13px] text-[#6c6f75]">
                No results for <span className="font-bold text-[#ababad]">{query}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {results.messages.length > 0 && (
                  <ResultSection title="Messages">
                    {results.messages.map((message) => (
                      <MessageResult key={message.id} message={message} query={normalizedQuery} teamName={teamName} />
                    ))}
                  </ResultSection>
                )}

                {results.channels.length > 0 && (
                  <ResultSection title="Channels">
                    {results.channels.map((channel) => (
                      <EntityResult
                        key={channel.id}
                        icon={<Hash size={14} />}
                        title={channel.displayName}
                        subtitle={teamName}
                        query={normalizedQuery}
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
                        title={chatLabel(chat)}
                        subtitle={chat.chatType === "group" ? "Group DM" : "Direct message"}
                        query={normalizedQuery}
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
      <h3 className="px-3 pb-1 text-[12px] font-bold uppercase tracking-wide text-[#6c6f75]">{title}</h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function MessageResult({ message, query, teamName }: { message: MSMessage; query: string; teamName: string }) {
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
      className="flex w-full gap-2 rounded-md px-3 py-2 text-left transition-colors duration-[80ms] hover:bg-[#27292d]"
    >
      <div className="mt-[3px] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[#1164a3] text-[10px] font-bold text-white">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-bold text-[#d1d2d3]">{author}</span>
          <span className="truncate text-[#6c6f75]">
            {teamName} · {formatMessageTime(message.createdDateTime)}
          </span>
        </div>
        <p className="truncate text-[13px] text-[#ababad]">{highlight(messageText(message), query)}</p>
      </div>
    </button>
  );
}

function EntityResult({
  icon,
  title,
  subtitle,
  query,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  query: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors duration-[80ms] hover:bg-[#27292d]"
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-[#d1d2d3]">{highlight(title, query)}</span>
        <span className="block truncate text-[12px] text-[#6c6f75]">{subtitle}</span>
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
      <span className="rounded-sm bg-[#1164a3] px-[2px] text-white">{value.slice(index, index + query.length)}</span>
      {value.slice(index + query.length)}
    </>
  );
}

function chatLabel(chat: MSChat): string {
  if (chat.topic) return chat.topic;
  const members = chat.members ?? [];
  if (members.length > 0) return members.map((member) => member.displayName).join(", ");
  return "Direct Message";
}

function messageText(message: MSMessage): string {
  return message.body.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
