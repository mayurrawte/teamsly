"use client";

/**
 * `useQuickReact` — Slack/Discord-style "press 1–6 while hovering a message
 * to react with it" keyboard shortcut. Reduces the friction of expressing
 * approval from (hover → click → pick) to a single keystroke.
 *
 * Why bound to 1–6 and not 1–9: Microsoft Graph's reaction API only
 * accepts the 6 fixed reactionTypes (like / heart / laugh / surprised /
 * sad / angry). Slot N maps to REACTION_TYPES[N-1].
 *
 * Returns `onMouseEnter` / `onMouseLeave` handlers the message row spreads
 * onto its outer element. The window-level keydown listener is installed
 * only while the row is hovered, so we never have hundreds of listeners
 * active.
 */

import { useCallback, useEffect, useState } from "react";
import { REACTION_TYPES, type ReactionType } from "@/lib/utils/reactions";

interface UseQuickReactArgs {
  onReact: ((reactionType: ReactionType) => void) | undefined;
  /** Suppress while a particular message is being edited / there's no react cb. */
  disabled?: boolean;
}

export function useQuickReact({ onReact, disabled }: UseQuickReactArgs) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered || disabled || !onReact) return;

    function onKeyDown(event: KeyboardEvent) {
      // Don't hijack number keys when the user is typing.
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      // Modifier keys break the "press a number" affordance — skip them.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const num = parseInt(event.key, 10);
      if (!Number.isFinite(num) || num < 1 || num > REACTION_TYPES.length) return;

      event.preventDefault();
      const reactionType = REACTION_TYPES[num - 1];
      onReact?.(reactionType);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hovered, disabled, onReact]);

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);

  return { onMouseEnter, onMouseLeave };
}
