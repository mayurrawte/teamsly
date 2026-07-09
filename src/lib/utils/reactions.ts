export const REACTION_EMOJI = {
  like: "👍",
  heart: "❤️",
  laugh: "😂",
  surprised: "😮",
  sad: "😢",
  angry: "😡",
} as const;

export type ReactionType = keyof typeof REACTION_EMOJI;

export const REACTION_TYPES = Object.keys(REACTION_EMOJI) as ReactionType[];

export function reactionEmoji(type: string): string {
  return REACTION_EMOJI[type as ReactionType] ?? type;
}

/** True only for one of the six supported Teams reaction types. */
export function isReactionType(type: string): type is ReactionType {
  return Object.prototype.hasOwnProperty.call(REACTION_EMOJI, type);
}

/**
 * Order-insensitive fingerprint of a message's reactions. Reconcile merges and
 * the memoized message row both key on lastModifiedDateTime, which Graph is
 * not guaranteed to bump for reaction-only changes — compare this alongside it
 * so reactions added by other people can't be silently discarded.
 */
export function reactionsSignature(
  reactions?: Array<{ reactionType: string; user: { id: string } }>
): string {
  if (!reactions || reactions.length === 0) return "";
  return reactions
    .map((r) => `${r.reactionType}:${r.user?.id ?? ""}`)
    .sort()
    .join("|");
}
