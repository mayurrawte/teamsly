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
