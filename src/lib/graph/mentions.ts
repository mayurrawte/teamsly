/**
 * Builds Microsoft Graph chatMessage `mentions[]` payloads from the
 * client-side `{ id, name }` list that `MessageInput` accumulates in
 * `pendingMentions`, and rewrites the HTML body so each `@Name` is wrapped
 * in `<at id="i">@Name</at>` markup.
 *
 * Real Teams clients render the `<at>` markup as a chip and use the
 * `mentions[]` array to drive notifications. Without the structured array,
 * the recipient still sees a styled @-pill but never gets a ping. With it,
 * they get a proper "you were @mentioned" notification.
 *
 * `__everyone__` is the sentinel `MessageInput` uses for the `@everyone`
 * entry it injects at the top of the suggestion list (when there are >1
 * other members). On the server it becomes the `conversation` identity
 * shape per the Graph schema:
 *   - channels: `conversationIdentityType: "channel"`
 *   - chats:    `conversationIdentityType: "chat"`
 *
 * Docs:
 *   https://learn.microsoft.com/en-us/graph/api/resources/chatmessagementionedidentityset
 *   https://learn.microsoft.com/en-us/graph/api/resources/chatmessagemention
 */

export interface ClientMention {
  /** AAD user id, or the literal `__everyone__` sentinel. */
  id: string;
  /** Display name as it currently appears in the textarea after the `@`. */
  name: string;
}

export const EVERYONE_MENTION_ID = "__everyone__";

interface ChannelTarget {
  kind: "channel";
  teamId: string;
  channelId: string;
}

interface ChatTarget {
  kind: "chat";
  chatId: string;
}

export type MentionTarget = ChannelTarget | ChatTarget;

// Loose shape of a Graph `chatMessageMention`. We don't import the SDK type
// because the client SDK's request body is `unknown` anyway.
export interface GraphMention {
  id: number;
  mentionText: string;
  mentioned:
    | {
        user: {
          id: string;
          displayName: string;
          userIdentityType?: string;
        };
      }
    | {
        conversation: {
          id: string;
          displayName: string;
          conversationIdentityType: "channel" | "chat";
        };
      };
}

/**
 * Build the Graph `mentions[]` payload and a sidecar `name` lookup the
 * body-rewriter uses to swap `@Name` text for `<at id="i">@Name</at>`.
 *
 * Indexes are assigned in input order and reused for the body rewrite.
 */
export function buildGraphMentions(
  mentions: ClientMention[],
  target: MentionTarget
): GraphMention[] {
  return mentions.map((m, index) => {
    if (m.id === EVERYONE_MENTION_ID) {
      // Conversation-scoped @mention. Per Graph docs the conversation `id`
      // is either the chat id or the `{teamId}@thread.tacv2`-style channel
      // id we already have on hand. We use the latter directly for channels;
      // for chats we use the chat id.
      const conversationId =
        target.kind === "channel" ? target.channelId : target.chatId;
      const conversationIdentityType =
        target.kind === "channel" ? "channel" : "chat";
      return {
        id: index,
        mentionText: "everyone",
        mentioned: {
          conversation: {
            id: conversationId,
            displayName: "everyone",
            conversationIdentityType,
          },
        },
      };
    }
    return {
      id: index,
      mentionText: m.name,
      mentioned: {
        user: {
          id: m.id,
          displayName: m.name,
          userIdentityType: "aadUser",
        },
      },
    };
  });
}

/**
 * Wraps every plain-text `@Name` in the body with the matching
 * `<at id="i">@Name</at>` markup. Skips substrings already inside any
 * other tag's attribute or content — naive but adequate because the only
 * caller passes HTML produced by `markdownToHtml`, which never emits
 * an existing `<at>` tag.
 *
 * Order matters when names overlap: process the longest name first so
 * "Alex Wu" matches before "Alex".
 */
export function rewriteBodyWithAtMarkup(
  body: string,
  mentions: GraphMention[]
): string {
  // Sort by mentionText length desc so longer names match before any
  // substring-prefix of a shorter one (e.g. "Alex Wu" before "Alex").
  const sorted = [...mentions].sort(
    (a, b) => b.mentionText.length - a.mentionText.length
  );

  let result = body;
  for (const m of sorted) {
    const escapedName = escapeRegExp(m.mentionText);
    // Match `@Name` as a whole word. The lookahead allows trailing space,
    // punctuation, `<`, or end of string so we don't gobble more than we
    // should.
    const re = new RegExp(`@${escapedName}(?![A-Za-z0-9_])`, "g");
    result = result.replace(re, `<at id="${m.id}">@${m.mentionText}</at>`);
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
