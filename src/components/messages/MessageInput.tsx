"use client";

import { useState, KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Send, Paperclip, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  placeholder: string;
  onSend: (content: string) => Promise<void>;
}

export function MessageInput({ placeholder, onSend }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setValue("");
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex items-end gap-2 rounded-lg border border-[#565856] bg-[#222529] px-3 py-2 transition-colors duration-150 focus-within:border-white">
        <button className="flex-shrink-0 rounded p-1 text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white">
          <Paperclip className="h-4 w-4" />
        </button>
        <TextareaAutosize
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxRows={8}
          disabled={sending}
          className="flex-1 resize-none bg-transparent text-[15px] text-[#d1d2d3] placeholder-[#6c6f75] outline-none disabled:opacity-50"
        />
        <div className="flex flex-shrink-0 items-center gap-1">
          <button className="rounded p-1 text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white">
            <Smile className="h-4 w-4" />
          </button>
          <button
            onClick={submit}
            disabled={!value.trim() || sending}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded transition-[background,color] duration-150 ease-out",
              value.trim() && !sending
                ? "bg-[#007a5a] text-white hover:bg-[#148567]"
                : "text-[#6c6f75]"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-[#6c6f75]">
        <kbd className="rounded bg-[#3f4144] px-1 py-0.5 text-[10px]">Enter</kbd> to send ·{" "}
        <kbd className="rounded bg-[#3f4144] px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
