// Anonymous polls — reactions-as-votes. A poll is an ordinary chat message
// whose body lists each option prefixed by a distinct reaction emoji; people
// vote by adding that reaction. The 6 Graph reaction types map positionally to
// up to 6 options, so this works in native Teams too (the text tells voters
// which emoji is which). Teamsly renders the same message as a PollCard.
//
// NOT truly anonymous: Graph records who reacted and native Teams shows it. The
// PollCard only ever shows aggregate counts, so it's "anonymous in Teamsly".

import { REACTION_EMOJI, REACTION_TYPES, type ReactionType } from "@/lib/utils/reactions";

// MSMessage is an ambient global type (see src/types/graph.ts), not a module export.

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = REACTION_TYPES.length; // 6 — the Graph reaction cap

const POLL_PREFIX = "📊 Poll:";
const VOTE_HINT = "React with an option's emoji to vote.";

export interface PollOption {
  text: string;
  reactionType: ReactionType;
  emoji: string;
}

export interface ParsedPoll {
  question: string;
  options: PollOption[];
}

export interface PollTally {
  /** Vote count per option, index-aligned with the poll's options. */
  counts: number[];
  /** Total votes cast across all options. */
  total: number;
  /** Whether the current user has voted each option (index-aligned). */
  myVotes: boolean[];
}

/** Parse `/poll Question | Option A | Option B` into its parts. */
export function parsePollCommand(
  args: string,
): { question: string; options: string[] } | { error: string } {
  const parts = args.split("|").map((p) => p.trim()).filter(Boolean);
  const [question, ...options] = parts;
  if (!question) {
    return { error: "Add a question, e.g. /poll Lunch where? | Tacos | Sushi" };
  }
  if (options.length < MIN_POLL_OPTIONS) {
    return { error: `Polls need at least ${MIN_POLL_OPTIONS} options, separated by " | ".` };
  }
  if (options.length > MAX_POLL_OPTIONS) {
    return { error: `Polls support up to ${MAX_POLL_OPTIONS} options.` };
  }
  return { question, options };
}

/** Build the plain-text message body that carries the poll (sent as usual). */
export function buildPollBody(question: string, options: string[]): string {
  const lines = [`${POLL_PREFIX} ${question}`];
  options.slice(0, MAX_POLL_OPTIONS).forEach((opt, i) => {
    lines.push(`${REACTION_EMOJI[REACTION_TYPES[i]]} ${opt}`);
  });
  lines.push(VOTE_HINT);
  return lines.join("\n");
}

/** Strip Graph's HTML wrapper to trimmed, non-empty plain-text lines. */
function toLines(content: string): string[] {
  return content
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function isPoll(content: string): boolean {
  const lines = toLines(content);
  return lines.length > 0 && lines[0].startsWith(POLL_PREFIX);
}

export function parsePoll(content: string): ParsedPoll | null {
  const lines = toLines(content);
  if (lines.length === 0 || !lines[0].startsWith(POLL_PREFIX)) return null;

  const question = lines[0].slice(POLL_PREFIX.length).trim();
  const options: PollOption[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const typeIdx = REACTION_TYPES.findIndex((t) => line.startsWith(REACTION_EMOJI[t]));
    if (typeIdx === -1) continue; // hint line or anything unexpected
    const reactionType = REACTION_TYPES[typeIdx];
    const emoji = REACTION_EMOJI[reactionType];
    options.push({ text: line.slice(emoji.length).trim(), reactionType, emoji });
  }

  if (options.length < MIN_POLL_OPTIONS) return null;
  return { question, options };
}

/** Does a reaction record match this option? Graph stores either the type
 *  name ("like") or the unicode emoji ("👍"), so accept both. */
function reactionMatchesOption(reactionType: string, option: PollOption): boolean {
  return reactionType === option.reactionType || reactionType === option.emoji;
}

export function tallyVotes(
  message: MSMessage,
  options: PollOption[],
  currentUserId: string,
): PollTally {
  const reactions = message.reactions ?? [];
  const counts = options.map(
    (opt) => reactions.filter((r) => reactionMatchesOption(r.reactionType, opt)).length,
  );
  const myVotes = options.map((opt) =>
    reactions.some((r) => r.user.id === currentUserId && reactionMatchesOption(r.reactionType, opt)),
  );
  return { counts, total: counts.reduce((a, b) => a + b, 0), myVotes };
}
