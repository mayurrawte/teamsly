# New Chat / Group Compose Implementation Plan (#92)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compose modal to start a new 1:1 or group chat (pick people → create via Graph → land in it).

**Architecture:** A `useNewChatStore` drives a `NewChatModal` (people picker reusing `GET /api/people`). `POST /api/chats` is extended to accept `{ userIds, topic? }`: 1 id reuses the existing one-on-one find-or-create, 2+ ids call a new `createGroupChat` Graph helper. On create, the chat is prepended to the workspace store (`patchChat`) and the app navigates to it.

**Tech Stack:** Next.js 16 route handler, Microsoft Graph (`POST /chats`), Zustand store, Radix Dialog, React client component, Tailwind v4 CSS-var tokens.

> **No unit-test harness:** no `npm test`. The gate is `npm run build` (Next 16 / Turbopack); it must stay green after each task, plus the listed manual check. `node_modules` is installed — do not reinstall. Branch `feat/new-chat-compose`; do NOT switch branches. Commits: Conventional, **no AI/agent co-author trailer**.

> **Codebase note:** `MSChat`/`MSChannel`/`MSMessage` are ambient global types (declared un-exported in `src/types/graph.ts`) — used across the app without imports. Use `MSChat` without importing it, matching existing files.

---

## File Structure

- **Create** `src/store/newChat.ts` — `useNewChatStore` (`isOpen`/`open`/`close`), mirrors `useSearchStore`.
- **Create** `src/components/modals/NewChatModal.tsx` — the compose modal.
- **Modify** `src/lib/graph/client.ts` — add `createGroupChat(...)`.
- **Modify** `src/app/api/chats/route.ts` — POST accepts `{ userIds, topic? }` (+ legacy `{ userId }`).
- **Modify** `src/components/sidebar/Sidebar.tsx` — wire the DMs-header `+` to open the modal.
- **Modify** `src/components/layout/AppShell.tsx` — mount `<NewChatModal />`.

---

## Task 1: Store + group-chat Graph helper + route

**Files:**
- Create: `src/store/newChat.ts`
- Modify: `src/lib/graph/client.ts`
- Modify: `src/app/api/chats/route.ts`

- [ ] **Step 1: Create the store**

`src/store/newChat.ts`:

```ts
"use client";

import { create } from "zustand";

interface NewChatState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useNewChatStore = create<NewChatState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

- [ ] **Step 2: Add `createGroupChat` to `src/lib/graph/client.ts`**

Add immediately after the existing `getOrCreateOneOnOneChat` function (it ends with `}) as Promise<MSChat>;\n}`):

```ts
export async function createGroupChat(
  accessToken: string,
  myId: string,
  userIds: string[],
  topic?: string
): Promise<MSChat> {
  const client = getGraphClient(accessToken);
  const members = [myId, ...userIds].map((id) => ({
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: ["owner"],
    "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${id}')`,
  }));
  const body: Record<string, unknown> = { chatType: "group", members };
  const trimmed = topic?.trim();
  if (trimmed) body.topic = trimmed;
  return client.api("/chats").post(body) as Promise<MSChat>;
}
```

- [ ] **Step 3: Extend the chats route POST**

Replace the whole `POST` handler in `src/app/api/chats/route.ts` (and add `createGroupChat` to the import from `@/lib/graph/client`):

Update the import line:

```ts
import { getChats, getMe, getOrCreateOneOnOneChat, createGroupChat } from "@/lib/graph/client";
```

Replace the `POST` function:

```ts
// Create a chat: 1 user id -> find-or-create 1:1; 2+ -> group (optional topic).
// Accepts the legacy `{ userId }` shape (search-result "open DM") too.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { userId?: string; userIds?: string[]; topic?: string };
  const ids = (body.userIds ?? (body.userId ? [body.userId] : [])).filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
  if (ids.length === 0) return NextResponse.json({ error: "Missing userIds" }, { status: 400 });

  try {
    const me = await getMe(session.accessToken);
    const chat =
      ids.length === 1
        ? await getOrCreateOneOnOneChat(session.accessToken, me.id, ids[0])
        : await createGroupChat(session.accessToken, me.id, ids, body.topic);
    return NextResponse.json(chat);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph] create chat failed:", msg);
    return NextResponse.json({ error: "Create chat failed", detail: msg }, { status: 502 });
  }
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/newChat.ts src/lib/graph/client.ts src/app/api/chats/route.ts
git commit -m "feat(chats): group-chat create + multi-id POST /api/chats"
```

---

## Task 2: The `NewChatModal` component

**Files:**
- Create: `src/components/modals/NewChatModal.tsx`

- [ ] **Step 1: Create the modal**

Mirrors `SearchModal`'s Radix Dialog chrome (`.search-modal-content` class + overlay). People search reuses `GET /api/people` (returns `{ id, displayName, email }[]`).

```tsx
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
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully` (confirms `MSChat` ambient type, `Avatar`, `useDebounce`, and the lucide icons `Search`/`X`/`Loader2`/`Users` all resolve).

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/NewChatModal.tsx
git commit -m "feat(chats): add new-chat compose modal with people picker"
```

---

## Task 3: Wire the entry point + mount the modal

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Import the store in `Sidebar.tsx`**

Add near the other store imports at the top of `src/components/sidebar/Sidebar.tsx`:

```ts
import { useNewChatStore } from "@/store/newChat";
```

- [ ] **Step 2: Make the DMs-header `+` a real, always-visible "New chat" button**

In `src/components/sidebar/Sidebar.tsx`, the DMs section header currently renders a bare decorative icon:

```tsx
              <Plus className="h-3 w-3 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100" />
```

Replace it with a button that opens the modal (and is always visible for discoverability):

```tsx
              <button
                type="button"
                aria-label="New chat"
                title="New chat"
                onClick={() => useNewChatStore.getState().open()}
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus:outline-none focus-visible:text-[var(--text-primary)]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
```

- [ ] **Step 3: Mount `<NewChatModal />` in `AppShell.tsx`**

Add the import near the other modal imports (next to `SearchModal`):

```ts
import { NewChatModal } from "@/components/modals/NewChatModal";
```

Render it alongside the existing modals — add `<NewChatModal />` immediately after the `<SearchModal ... />` element (it self-manages via `useNewChatStore`, no props):

```tsx
      <NewChatModal />
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 5: Manual check**

`npm run dev`, sign in. In the sidebar **Direct Messages** header, click the **+** (New chat):
- Search a colleague → click them (they become a chip) → **Start chat** → lands in a 1:1; the chat shows in the sidebar.
- Add 2+ people → a **Group name** field appears → type a name → **Start group** → lands in a new group chat; it shows in the sidebar.
- Re-compose the same single person → opens the existing DM (no duplicate).
- Confirm the existing search-modal "open DM for an org person" still works (legacy `{ userId }` path).

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/Sidebar.tsx src/components/layout/AppShell.tsx
git commit -m "feat(chats): wire new-chat compose entry in the sidebar"
```

---

## Final verification

- [ ] `npm run build` green.
- [ ] The existing search-result → open-DM path is unchanged (legacy `{ userId }`).
- [ ] Open a PR with `Closes #92`.
