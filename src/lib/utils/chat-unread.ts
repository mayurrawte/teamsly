// Compute whether a DM/group chat has unread messages, from the chat-list data
// Graph returns. Graph gives no per-chat unread *count*, so this is a boolean
// "has unread" used to show an indicator.
//
// A chat is unread when its last message is newer than what the user has seen,
// and that last message isn't the user's own. "Seen" = the later of Graph's
// viewpoint.lastMessageReadDateTime (advances only in official Teams) and the
// local read time recorded when the user opens/marks the chat read here.

function toMs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function isChatUnread(
  chat: MSChat,
  currentUserId: string,
  localReadAt: number | undefined,
): boolean {
  const preview = chat.lastMessagePreview;
  const lastMessageAt = toMs(preview?.createdDateTime);
  if (!lastMessageAt) return false;

  // Our own last message never counts as unread.
  const fromId = preview?.from?.user?.id;
  if (fromId && fromId === currentUserId) return false;

  const seenAt = Math.max(toMs(chat.viewpoint?.lastMessageReadDateTime), localReadAt ?? 0);
  return lastMessageAt > seenAt;
}
