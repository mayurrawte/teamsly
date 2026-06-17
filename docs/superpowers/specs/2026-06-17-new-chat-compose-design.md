# New Chat / Group Chat Compose — Design (#92)

**Goal:** Let the user start a brand-new 1:1 or group chat from Teamsly — pick one or more people, create the chat via Graph, and land in it. Today Teamsly can only open chats that already exist.

**Why:** Table stakes for a messaging daily driver. There's no compose entry anywhere; `POST /api/chats` only find-or-creates 1:1s as a search side-effect, and group creation doesn't exist.

## Approach

A single **unified compose modal**. One people picker (reuses the existing org-directory search): **1 person → 1:1** (reuses the existing find-or-create), **2+ → group** (new Graph create + optional name). "Start chat" creates the chat, prepends it to the sidebar, and navigates to it; the user types the first message in the normal composer (Teams-native — no message field in the modal).

This reuses two existing primitives:
- `GET /api/people?q=` → `searchPeople` → `PersonResult { id, displayName, email }` (org `/users` `$search`).
- `POST /api/chats` (currently 1:1 find-or-create via `getOrCreateOneOnOneChat`) — extended for groups.

## Components / files

### New
- **`src/store/newChat.ts`** — `useNewChatStore` with `open: boolean` + `setOpen(v)`, mirroring `useSearchStore`. Drives the modal.
- **`src/components/chat/NewChatModal.tsx`** *(client)* — the compose modal:
  - A search input (debounced ~300ms; min 2 chars, matching `/api/people`) → fetches `/api/people?q=` → results list.
  - Clicking a result adds it as a removable **chip**; already-selected people and the current user are excluded from results.
  - When **2+** people are selected, an optional **"Group name"** text field appears.
  - A **"Start chat"** button (disabled until ≥1 selected); on click it POSTs, then navigates. Shows a spinner + disables while creating; surfaces an inline error on failure.
  - Reuses the existing modal chrome (`.search-modal-content` styling) + `Avatar` + `getChatLabel` conventions; Escape / backdrop closes.

### Modified
- **`src/lib/graph/client.ts`** — add `createGroupChat(accessToken, meId, userIds: string[], topic?: string): Promise<MSChat>`: `POST /chats` with `chatType: "group"`, `members` = the current user + each `userId` as `aadUserConversationMember` (`roles: ["owner"]`, `user@odata.bind`), and `topic` when provided. Returns the created chat shaped like `getChats` yields (id, chatType, topic, members); if the create response omits members, expand/refetch so the sidebar + chat header render.
- **`src/app/api/chats/route.ts`** (POST) — accept `{ userIds: string[], topic?: string }` **and** keep the legacy `{ userId }` (the search-result caller). Normalize: `ids = body.userIds ?? (body.userId ? [body.userId] : [])`. `ids.length === 1` → `getOrCreateOneOnOneChat`; `ids.length >= 2` → `createGroupChat`; `0` → 400. Returns the chat.
- **`src/components/sidebar/Sidebar.tsx`** — make the DMs section-header `+` a real button (`aria-label="New chat"`, `onClick` → `useNewChatStore.setOpen(true)`); keep it visible (not hover-only) so it's discoverable.
- **`src/components/layout/AppShell.tsx`** — mount `<NewChatModal />` once (alongside the other modals).

## Data flow

picker input → `GET /api/people?q=` → select chips → **Start** → `POST /api/chats {userIds, topic?}` → route picks 1:1 vs group → returns the chat → `patchChat(chat)` (prepends it to the sidebar store) → `router.push('/workspace/dm/{chat.id}')` → modal closes → user composes the first message in the normal chat view.

## Edge cases

- **Self & duplicates:** the current user and already-picked people are filtered out of results; re-adding is a no-op.
- **Existing 1:1:** find-or-create returns the existing chat → navigates there (no duplicate).
- **No results / search error:** show a calm empty/"couldn't search" state; don't block the modal.
- **Create failure** (Graph 502): inline error in the modal, keep the picked people so the user can retry.
- **Group minimum:** Teams groups need 3+ participants; that's exactly "2+ others selected → group", enforced by the count logic.
- **Empty `userIds`:** "Start chat" stays disabled; the route 400s defensively.

## Out of scope (YAGNI)

- Adding people to an *existing* chat. · A first-message field in the modal (typed in the chat view). · Channel creation. · Group photo/avatar. · Presence indicators in the picker. · A ⌘N shortcut (can add later).

## Testing

- `npm run build` green (Next 16 / Turbopack).
- Manual:
  - Compose → search a colleague → pick 1 → **Start** → lands in a 1:1 with them; it appears in the sidebar.
  - Pick 2+ + a group name → **Start** → lands in a new group chat with that topic; it appears in the sidebar.
  - Re-composing the same single person → opens the existing DM (no duplicate).
  - The existing search-result "open DM" path (legacy `{ userId }`) still works.
