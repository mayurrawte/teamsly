# Anonymous polls — design (#37)

**Date:** 2026-06-03
**Scope:** Medium. Reactions-as-votes (shared, live). Single-choice. `/poll` slash command.

## Mechanism

Teams/Graph has no poll primitive. A poll is a normal chat message whose body
lists each option prefixed by a distinct **reaction emoji**; people vote by
adding that reaction. The 6 Graph reaction types (👍❤️😂😮😢😡) map positionally
to up to **6 options** (min 2). Works in native Teams too — the message text
says which emoji = which option — and Teamsly renders it as a rich card.

### Anonymity caveat (documented, accepted)
Reactions are **not** truly anonymous: Graph records the reactor and native Teams
shows reaction authors on hover. Teamsly's PollCard shows **counts only, never
voter names**, so it is "anonymous *in Teamsly*". The card footer states this.

## Pieces

### 1. `src/lib/polls/index.ts` (pure, no React)
- `MAX_POLL_OPTIONS = 6`, `MIN_POLL_OPTIONS = 2`.
- `parsePollCommand(args)` → `{question, options[]}` | `{error}` from `Question | A | B`.
- `buildPollBody(question, options)` → the emoji-prefixed plain-text body that gets sent.
- `isPoll(content)` / `parsePoll(content)` → detect + parse back (HTML-tolerant: strips
  `<p>`/`<br>`/tags, unescapes entities). Sentinel: first line starts with `📊 Poll:`.
- `tallyVotes(message, options, currentUserId)` → `{counts[], total, myVotes[]}`,
  matching reactions stored as either type name (`"like"`) or emoji (`"👍"`).
- Build and parse share the `REACTION_EMOJI`/`REACTION_TYPES` constants so option↔type
  mapping is consistent.

### 2. `src/components/messages/PollCard.tsx`
Question + one row per option (emoji · text · % bar · count · highlight if you voted) +
footer (`N votes · anonymous in Teamsly`). Row click → `onVote(reactionType)`. Disabled
for pending/failed messages.

### 3. MessageItem integration
Compute `poll = isPoll(raw) ? parsePoll(raw) : null` once. In **both** render branches
(group-head + continuation): when `poll`, render `<PollCard>` in place of the body and
**suppress** the normal `ReactionsRow` + link/GitHub cards (reactions are the votes).
`handlePollVote(reactionType)` enforces single-choice: unset any other option the user
voted, then toggle the chosen one — reusing the existing `onToggleReaction` toggle.

### 4. `/poll` slash command (`src/lib/slash-commands/index.ts`)
`requiresArgs: true`, usage `/poll Question | Option A | Option B`. Parses via
`parsePollCommand`; returns `{kind:"error"}` on bad input, else `{kind:"text", text:
buildPollBody(...)}`, which flows through the normal send path (`doSend`).

## Verification
`npm run build` green. Manual: `/poll Lunch? | Tacos | Sushi` → card renders; click an
option → reaction fires, count updates, switching options moves the vote (single-choice);
counts-only, no names.
