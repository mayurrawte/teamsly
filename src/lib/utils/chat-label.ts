// Canonical helpers for deriving a human-readable label and the "other"
// participant of a Microsoft Teams chat. Several views previously held
// near-duplicate copies; a few of them forgot to filter out the current
// user and showed `"You, Alice"` instead of `"Alice"`. Use these everywhere.

export function getChatLabel(
  chat: MSChat | undefined,
  currentUserId: string
): string {
  if (!chat) return "";

  const members = chat.members ?? [];
  const others = members.filter((m) => (m.userId ?? m.id) !== currentUserId);

  // For 1:1 chats always prefer the other member's name. Graph sometimes
  // returns a stale `topic` (e.g. the current user's own name) for oneOnOne
  // chats, which would otherwise hide who you're chatting with.
  if (chat.chatType === "oneOnOne" && others[0]?.displayName) {
    return others[0].displayName;
  }

  if (chat.topic) return chat.topic;

  // Members haven't loaded yet — return empty string so the header shows
  // nothing rather than the misleading "Direct Message" placeholder.
  if (members.length === 0) return "";

  if (others.length === 0) {
    const name = members[0]?.displayName ?? "You";
    return `${name} (you)`;
  }
  return others.map((m) => m.displayName).filter(Boolean).join(", ");
}

export function getFirstOtherMember(
  chat: MSChat | undefined,
  currentUserId: string
): MSChatMember | undefined {
  const members = chat?.members ?? [];
  const others = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  return others[0] ?? members[0];
}
