"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { MessageInput } from "./MessageInput";
import { MessageItem } from "./MessageItem";
import { useWorkspaceStore } from "@/store/workspace";
import { useToastStore } from "@/store/toasts";

interface ThreadPanelProps {
  message: MSMessage | null;
  open: boolean;
  onClose: () => void;
  onSendReply?: (messageId: string, content: string) => Promise<MSMessage>;
}

export function ThreadPanel({ message, open, onClose, onSendReply }: ThreadPanelProps) {
  const [localReplies, setLocalReplies] = useState<MSMessage[]>([]);
  const currentUserId = useWorkspaceStore((state) => state.currentUserId);
  const currentUserName = useWorkspaceStore((state) => state.currentUserName);
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    setLocalReplies(message?.replies ?? []);
  }, [message?.id]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  async function handleReply(content: string) {
    if (!message) return;

    const optimisticReply: MSMessage = {
      id: `thread-reply-${Date.now()}`,
      createdDateTime: new Date().toISOString(),
      body: { contentType: "text", content },
      from: { user: { id: currentUserId, displayName: currentUserName } },
      reactions: [],
    };

    setLocalReplies((replies) => [...replies, optimisticReply]);
    if (!onSendReply) return;

    try {
      const savedReply = await onSendReply(message.id, content);
      setLocalReplies((replies) =>
        replies.map((reply) => (reply.id === optimisticReply.id ? savedReply : reply))
      );
    } catch {
      setLocalReplies((replies) => replies.filter((reply) => reply.id !== optimisticReply.id));
      showToast({ title: "Could not send reply", tone: "error" });
      throw new Error("Failed to send reply");
    }
  }

  if (!message) return null;

  return (
    <aside
      className={[
        "absolute bottom-0 right-0 top-0 z-50 flex w-[360px] flex-col border-l border-[#3f4144] bg-[#1a1d21] shadow-[-4px_0_16px_rgba(0,0,0,0.3)]",
        "transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        open ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
      aria-hidden={!open}
    >
      <header className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[#3f4144] px-4">
        <h2 className="text-[18px] font-black text-white">Thread</h2>
        <button
          type="button"
          aria-label="Close thread"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto py-2">
        <MessageItem message={message} isGroupHead />
        {localReplies.length > 0 && (
          <div className="my-2 flex items-center px-4">
            <div className="h-px flex-1 bg-[#3f4144]" />
            <span className="mx-3 text-[12px] font-bold text-[#6c6f75]">
              {localReplies.length} {localReplies.length === 1 ? "reply" : "replies"}
            </span>
            <div className="h-px flex-1 bg-[#3f4144]" />
          </div>
        )}
        {localReplies.map((reply) => (
          <MessageItem key={reply.id} message={reply} isGroupHead />
        ))}
      </div>

      <div className="flex-shrink-0">
        <MessageInput placeholder="Reply in thread..." onSend={handleReply} />
      </div>
    </aside>
  );
}
