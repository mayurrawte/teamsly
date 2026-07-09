/**
 * Background-warms the message cache for the user's top-N most-visited
 * contexts on cold start, so the *first* click after launch feels as fast
 * as later clicks (which already paint from the in-memory store hydrated
 * from IDB via `hydrateMessageCache`).
 *
 * Strategy: best-effort. We don't block UI on any of these fetches,
 * swallow errors silently, and stagger them so a slow network can't burn
 * concurrency budget reserved for whatever the user actually clicks on.
 */

import { getTopVisited, type VisitTarget } from "./visit-counter";
import { useWorkspaceStore } from "@/store/workspace";

function urlFor(target: VisitTarget): string {
  // Visit targets hold raw Graph ids; encode for the URL exactly like the
  // router does so the API route receives the same param form the views send.
  return target.kind === "channel"
    ? `/api/messages/${target.teamId}/${encodeURIComponent(target.channelId)}`
    : `/api/chats/${encodeURIComponent(target.chatId)}/messages`;
}

function contextIdFor(target: VisitTarget): string {
  // Match the views' keyspace: they key messagesByContext by their route
  // params, which arrive percent-encoded. Writing the raw id here warmed a
  // key nothing ever read.
  return target.kind === "channel"
    ? `${target.teamId}:${encodeURIComponent(target.channelId)}`
    : encodeURIComponent(target.chatId);
}

/**
 * Kick off background fetches for the top-N most-visited contexts.
 * Already-warm contexts (i.e. already in `messagesByContext`) are skipped
 * — IDB hydration filled them, so a network round-trip would just push
 * the same data through `setMessages`.
 *
 * Caller is `AppShell` immediately after `hydrateMessageCache()` resolves.
 */
export async function warmTopVisited(n = 3, excludeContextId?: string | null): Promise<void> {
  const targets = getTopVisited(n, excludeContextId);
  if (targets.length === 0) return;

  const { messagesByContext, setMessages } = useWorkspaceStore.getState();

  for (const target of targets) {
    const contextId = contextIdFor(target);
    if (messagesByContext[contextId]?.length) continue;
    // Stagger so each fetch gets its own connection slot and we don't
    // hammer the API in a single burst on a flaky network.
    try {
      const res = await fetch(urlFor(target));
      if (!res.ok) continue;
      const messages = (await res.json()) as MSMessage[];
      if (Array.isArray(messages) && messages.length > 0) {
        setMessages(contextId, messages);
      }
    } catch {
      /* network hiccup, skip */
    }
  }
}
