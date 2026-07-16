/** Celebration detector (#72 motion pass): a message that is nothing but
 * emoji, at least one of which is a celebration trigger, earns confetti. */
const TRIGGERS = ["\u{1F389}", "\u{1F38A}", "\u{1F973}"]; // 🎉 🎊 🥳
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

export function isCelebrationMessage(raw: string): boolean {
  const text = raw.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  if (!text || text.length > 32) return false;
  if (!TRIGGERS.some((t) => text.includes(t))) return false;
  return EMOJI_ONLY.test(text);
}
