/**
 * Thread-panel selectors (#164). The panel opens from a snapshot captured in
 * component state; these keep it tracking the live store while open.
 */

/** Live parent from the message window by id; snapshot fallback if it left the window. */
export function selectThreadParent(
  messages: MSMessage[],
  snapshot: MSMessage | null
): MSMessage | null {
  if (!snapshot) return null;
  return messages.find((m) => m.id === snapshot.id) ?? snapshot;
}

/** Server replies first, then optimistic local replies not yet echoed back by the server. */
export function mergeThreadReplies(
  serverReplies: MSMessage[] | undefined,
  localReplies: MSMessage[]
): MSMessage[] {
  const server = serverReplies ?? [];
  if (server.length === 0) return localReplies;
  const serverIds = new Set(server.map((m) => m.id));
  return [...server, ...localReplies.filter((m) => !serverIds.has(m.id))];
}
