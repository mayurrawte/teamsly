"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Bookmark, Smile, MessageSquare, Forward, Pin, MoreHorizontal, Trash2, Pencil, type LucideIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { EmojiPicker } from "./EmojiPicker";
import { cn } from "@/lib/utils";
import type { ReactionType } from "@/lib/utils/reactions";

interface Props {
  messageId: string;
  onReact?: (messageId: string, reactionType: ReactionType) => void;
  onReplyInThread?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  /** Toggle save-for-later. When `isSaved`, the icon shows filled. */
  onSave?: (messageId: string) => void;
  isSaved?: boolean;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export function MessageHoverToolbar({
  messageId,
  onReact,
  onReplyInThread,
  onForward,
  onPin,
  onSave,
  isSaved,
  onEdit,
  onDelete,
}: Props) {
  const showMoreMenu = onEdit || onDelete;

  return (
    <div
      className="absolute right-2 top-[-20px] z-[100] flex gap-[2px] rounded-md border border-[var(--border)] bg-[#1a1d21] px-1 py-[2px] opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-opacity duration-[var(--motion-fast)] ease-out group-hover:opacity-100"
      role="toolbar"
      aria-label="Message actions"
    >
      <EmojiPicker onSelect={(reactionType) => onReact?.(messageId, reactionType)}>
        <ToolbarButton icon={Smile} label="Add reaction" />
      </EmojiPicker>
      {onReplyInThread && (
        <ToolbarButton icon={MessageSquare} label="Reply in thread" onClick={() => onReplyInThread(messageId)} />
      )}
      {onForward && <ToolbarButton icon={Forward} label="Forward message" onClick={() => onForward(messageId)} />}
      {onSave && (
        <ToolbarButton
          icon={Bookmark}
          label={isSaved ? "Remove from Later" : "Save for later"}
          onClick={() => onSave(messageId)}
          active={isSaved}
        />
      )}
      {onPin && <ToolbarButton icon={Pin} label="Pin message" onClick={() => onPin(messageId)} />}
      {showMoreMenu && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <ToolbarButton icon={MoreHorizontal} label="More actions" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              sideOffset={4}
              className="z-[200] min-w-[160px] rounded-md border border-[var(--border)] bg-[#1a1d21] py-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
            >
              {onEdit && (
                <DropdownMenu.Item
                  onSelect={() => onEdit(messageId)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)]"
                >
                  <Pencil size={14} strokeWidth={2} />
                  Edit message
                </DropdownMenu.Item>
              )}
              {onDelete && (
                <DropdownMenu.Item
                  onSelect={() => onDelete(messageId)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-400 outline-none hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)]"
                >
                  <Trash2 size={14} strokeWidth={2} />
                  Delete message
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

interface ToolbarButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon: LucideIcon;
  label: string;
  /** Visual press-state; used by Save-for-later to indicate the message is bookmarked. */
  active?: boolean;
}

// forwardRef + prop spread so this works as a Radix `asChild` trigger: the
// dropdown/popover injects onPointerDown/onKeyDown/ref onto its child, and a
// plain component that only re-wired onClick silently dropped them (which left
// the "More actions" DropdownMenu unopenable — it opens on pointerdown, not click).
const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { icon: Icon, label, active, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active ?? undefined}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)] hover:text-white focus-ring",
        active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]",
        className
      )}
      {...rest}
    >
      <Icon size={16} strokeWidth={2} fill={active ? "currentColor" : "none"} />
    </button>
  );
});
