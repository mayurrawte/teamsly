export interface SlashCommandContext {
  currentUserName: string;
  currentUserId: string;
  channelMembers?: Array<{ id: string; displayName: string }>;
}

export type SlashCommandResult =
  | { kind: "text"; text: string; italic?: boolean }
  | { kind: "gif"; query: string }
  | { kind: "error"; message: string };

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  requiresArgs: boolean;
  execute(
    args: string,
    ctx: SlashCommandContext
  ): SlashCommandResult | Promise<SlashCommandResult>;
}

const EIGHTBALL_ANSWERS = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
];

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "coinflip",
    aliases: ["flip"],
    description: "Flip a coin",
    usage: "/coinflip",
    requiresArgs: false,
    execute() {
      const result = rand(2) === 0 ? "Heads" : "Tails";
      return { kind: "text", text: `🪙 **${result}!**` };
    },
  },
  {
    name: "roll",
    description: "Roll dice",
    usage: "/roll [N] or /roll [X]d[Y]",
    requiresArgs: false,
    execute(args) {
      const trimmed = args.trim();

      if (!trimmed) {
        const result = rand(6) + 1;
        return { kind: "text", text: `🎲 Rolled **${result}** (1d6)` };
      }

      const xdyMatch = trimmed.match(/^(\d+)d(\d+)$/i);
      if (xdyMatch) {
        const x = parseInt(xdyMatch[1], 10);
        const y = parseInt(xdyMatch[2], 10);
        if (x < 1 || x > 100 || y < 1) {
          return { kind: "error", message: "Dice must be 1–100 count and at least 1 side." };
        }
        const rolls = Array.from({ length: x }, () => rand(y) + 1);
        const total = rolls.reduce((a, b) => a + b, 0);
        const detail = x > 1 ? ` (${trimmed}: ${rolls.join(", ")})` : ` (${trimmed})`;
        return { kind: "text", text: `🎲 Rolled **${total}**${detail}` };
      }

      const nMatch = trimmed.match(/^(\d+)$/);
      if (nMatch) {
        const n = parseInt(nMatch[1], 10);
        if (n < 1 || n > 1000) {
          return { kind: "error", message: "Die size must be between 1 and 1000." };
        }
        const result = rand(n) + 1;
        return { kind: "text", text: `🎲 Rolled **${result}** (1d${n})` };
      }

      return { kind: "error", message: `Unrecognised format — try /roll, /roll 20, or /roll 3d6.` };
    },
  },
  {
    name: "draw",
    description: "Draw a random person",
    usage: "/draw [@u1 @u2 ...]",
    requiresArgs: false,
    execute(args, ctx) {
      const trimmed = args.trim();

      if (trimmed) {
        const names = trimmed.split(/\s+/).filter(Boolean);
        const picked = names[rand(names.length)];
        return { kind: "text", text: `🎯 Drew **${picked}** from the hat` };
      }

      const pool = (ctx.channelMembers ?? []).filter((m) => m.id !== ctx.currentUserId);
      if (pool.length === 0) {
        return {
          kind: "error",
          message: "No members to draw from — try /draw @alice @bob",
        };
      }
      const picked = pool[rand(pool.length)];
      return { kind: "text", text: `🎯 Drew **${picked.displayName}** from the hat` };
    },
  },
  {
    name: "shrug",
    description: "Insert a shrug",
    usage: "/shrug [text]",
    requiresArgs: false,
    execute(args) {
      const tail = args.trim();
      return { kind: "text", text: `¯\\_(ツ)_/¯${tail ? ` ${tail}` : ""}` };
    },
  },
  {
    name: "tableflip",
    description: "Flip a table",
    usage: "/tableflip [text]",
    requiresArgs: false,
    execute(args) {
      const tail = args.trim();
      return { kind: "text", text: `(╯°□°)╯︵ ┻━┻${tail ? ` ${tail}` : ""}` };
    },
  },
  {
    name: "unflip",
    description: "Put the table back",
    usage: "/unflip [text]",
    requiresArgs: false,
    execute(args) {
      const tail = args.trim();
      return { kind: "text", text: `┬─┬ノ( º _ ºノ)${tail ? ` ${tail}` : ""}` };
    },
  },
  {
    name: "me",
    description: "Send an action in italics",
    usage: "/me <action>",
    requiresArgs: true,
    execute(args, ctx) {
      const action = args.trim();
      if (!action) {
        return { kind: "error", message: "Tell me what you're doing: /me <action>" };
      }
      return {
        kind: "text",
        text: `*${ctx.currentUserName} ${action}*`,
        italic: true,
      };
    },
  },
  {
    name: "8ball",
    description: "Ask the magic 8-ball",
    usage: "/8ball <question>",
    requiresArgs: true,
    execute(args) {
      const question = args.trim();
      if (!question) {
        return { kind: "error", message: "Ask a question: /8ball <question>" };
      }
      const answer = EIGHTBALL_ANSWERS[rand(EIGHTBALL_ANSWERS.length)];
      return {
        kind: "text",
        text: `🎱 *Question:* ${question}\n*Answer:* ${answer}`,
      };
    },
  },
  {
    name: "giphy",
    aliases: ["gif"],
    description: "Send a GIF",
    usage: "/giphy <query>",
    requiresArgs: true,
    execute(args) {
      const query = args.trim();
      if (!query) {
        return { kind: "error", message: "Provide a search term: /giphy <query>" };
      }
      return { kind: "gif", query };
    },
  },
];

export function parseSlashCommand(
  input: string
): { command: SlashCommand; args: string } | null {
  const match = input.match(/^\/(\w+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const args = match[2] ?? "";
  const command = SLASH_COMMANDS.find(
    (c) => c.name === name || (c.aliases ?? []).includes(name)
  );
  if (!command) return null;
  return { command, args };
}
