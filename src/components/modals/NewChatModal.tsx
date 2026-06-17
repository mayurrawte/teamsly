"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X, Loader2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useNewChatStore } from "@/store/newChat";
import { useWorkspaceStore } from "@/store/workspace";

interface Person {
  id: string;
  displayName: string;
  email: string;
}

export function NewChatModal() {
  const isOpen = useNewChatStore((s) => s.isOpen);
  const close = useNewChatStore((s) => s.close);
  const router = useRouter();
  const patchChat = useWorkspaceStore((s) => s.patchChat);
  const currentUserId = useWorkspaceStore((s) => s.currentUserId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Person[]>([]);
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset everything when the modal closes; focus the input when it opens.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelected([]);
      setTopic("");
      setError(null);
      setCreating(false);
    }
  }, [isOpen]);

  // Debounced org-directory search.
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetch(`/api/people?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setResults(Array.isArray(data) ? (data as Person[]) : []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const selectedIds = new Set(selected.map((p) => p.id));
  const visibleResults = results.filter((p) => p.id !== currentUserId && !selectedIds.has(p.id));
  const isGroup = selected.length >= 2;

  function add(p: Person) {
    setSelected((s) => (s.some((x) => x.id === p.id) ? s : [...s, p]));
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    setSelected((s) => s.filter((p) => p.id !== id));
  }

  async function start() {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selected.map((p) => p.id),
          topic: isGroup && topic.trim() ? topic.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const chat = (await res.json()) as MSChat;
      if (!chat?.id) throw new Error("no chat id");
      patchChat(chat);
      close();
      router.push(`/workspace/dm/${chat.id}`);
    } catch {
      setError("Couldn't start the chat. Please try again.");
      setCreating(false);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="search-modal-overlay fixed inset-0 z-[60] bg-[var(--modal-overlay)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="search-modal-content fixed top-1/2 z-[70] flex max-h-[70vh] w-[480px] max-w-[calc(100vw-var(--sidebar-offset)-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--modal-bg)] text-[var(--text-primary)] shadow-[0_16px_64px_rgba(0,0,0,0.6)] outline-none"
          style={{ left: "calc(50% + var(--sidebar-offset) / 2)" }}
        >
          <Dialog.Title className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-[15px] font-bold">
            New chat
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Title>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] px-4 py-2">
              {selected.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--surface-raised)] py-0.5 pl-1 pr-2 text-[12px] text-[var(--text-primary)]"
                >
                  <Avatar displayName={p.displayName} userId={p.id} size={18} />
                  {p.displayName}
                  <button
                    type="button"
                    aria-label={`Remove ${p.displayName}`}
                    onClick={() => remove(p.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2 text-[var(--text-secondary)]">
            <Search className="h-4 w-4 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people by name or email"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            {searching && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
              >
                <Avatar displayName={p.displayName} userId={p.id} size={32} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-[var(--text-primary)]">{p.displayName}</div>
                  {p.email && <div className="truncate text-[12px] text-[var(--text-muted)]">{p.email}</div>}
                </div>
              </button>
            ))}
            {!searching && debounced.trim().length >= 2 && visibleResults.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">No people found.</p>
            )}
          </div>

          {isGroup && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2 text-[var(--text-secondary)]">
              <Users className="h-4 w-4 flex-shrink-0" />
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Group name (optional)"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
            <span className="text-[12px] text-red-400">{error}</span>
            <button
              type="button"
              onClick={start}
              disabled={selected.length === 0 || creating}
              className="flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isGroup ? "Start group" : "Start chat"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
