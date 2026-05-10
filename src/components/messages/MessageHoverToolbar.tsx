"use client";

import { Smile, MessageSquare, Forward, Pin, MoreHorizontal, type LucideIcon } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import type { ReactionType } from "@/lib/utils/reactions";

interface Props {
  messageId: string;
  onReact?: (messageId: string, reactionType: ReactionType) => void;
  onReplyInThread?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onMore?: (messageId: string) => void;
}

export function MessageHoverToolbar({
  messageId,
  onReact,
  onReplyInThread,
  onForward,
  onPin,
  onMore,
}: Props) {
  return (
    <div
      className="absolute right-2 top-[-18px] z-[100] flex translate-y-1 gap-[2px] rounded-md border border-[#3f4144] bg-[#1a1d21] px-1 py-[2px] opacity-0 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-[opacity,transform] duration-[80ms] ease-out group-hover:translate-y-0 group-hover:opacity-100"
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
      {onPin && <ToolbarButton icon={Pin} label="Pin message" onClick={() => onPin(messageId)} />}
      {onMore && <ToolbarButton icon={MoreHorizontal} label="More actions" onClick={() => onMore(messageId)} />}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

function ToolbarButton({ icon: Icon, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded text-[#ababad] transition-colors duration-100 hover:bg-[#27292d] hover:text-white"
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}
