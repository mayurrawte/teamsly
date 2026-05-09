"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { UserProfilePopover } from "@/components/profile/UserProfilePopover";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";

interface DemoUserFooterProps {
  availability?: MSPresence["availability"];
}

export function DemoUserFooter({ availability = "Available" }: DemoUserFooterProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-t border-[#3f4144] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <UserProfilePopover userId="you" displayName="You (Demo)" availability={availability}>
            <button type="button" className="relative flex h-9 w-9 flex-shrink-0">
              <Avatar userId="you" displayName="You (Demo)" size={36} />
              <PresenceDot availability={availability} />
            </button>
          </UserProfilePopover>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[13px] font-semibold text-white">You (Demo)</p>
            <p className="text-[11px] text-[#2bac76]">● Active</p>
          </div>
        </div>
        <button
          type="button"
          title="Settings"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className="rounded p-1 text-[#ababad] hover:bg-[#27292d] hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        account={{ name: "You (Demo)", initials: "YO", badge: "Demo session" }}
      />
    </>
  );
}
