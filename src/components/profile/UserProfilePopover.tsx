"use client";

import * as Popover from "@radix-ui/react-popover";
import { MessageSquare, Phone, Video, X } from "lucide-react";
import { openTeamsCall } from "@/lib/utils/teams-deeplink";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";

interface UserProfilePopoverProps {
  userId: string;
  displayName: string;
  email?: string;
  availability?: MSPresence["availability"];
  children: React.ReactNode;
  onSendDm?: () => void;
}

export function UserProfilePopover({
  userId,
  displayName,
  email,
  availability = "Available",
  children,
  onSendDm,
}: UserProfilePopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          className="z-[120] w-[300px] overflow-hidden rounded-lg border border-[#3f4144] bg-[#1a1d21] text-[#d1d2d3] shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-start justify-between border-b border-[#3f4144] px-4 py-3">
            <div className="relative flex h-12 w-12 flex-shrink-0">
              <Avatar userId={userId} displayName={displayName} size={36} className="!h-12 !w-12" />
              <PresenceDot availability={availability} />
            </div>
            <Popover.Close
              aria-label="Close profile"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
            >
              <X size={16} />
            </Popover.Close>
          </div>

          <div className="px-4 py-3">
            <h3 className="truncate text-[18px] font-black text-white">{displayName}</h3>
            {email && <p className="truncate text-[13px] text-[#ababad]">{email}</p>}
            <p className="mt-1 text-[12px] text-[#2bac76]">{presenceLabel(availability)}</p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onSendDm}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-[#0F5A8F] px-3 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-[#0A4571]"
              >
                <MessageSquare size={14} />
                Send DM
              </button>
              {email && (
                <>
                  <button
                    type="button"
                    onClick={() => openTeamsCall([email])}
                    title="Call"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#3f4144] bg-transparent text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
                  >
                    <Phone size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openTeamsCall([email], { withVideo: true })}
                    title="Video call"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#3f4144] bg-transparent text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
                  >
                    <Video size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function presenceLabel(availability: MSPresence["availability"]): string {
  if (availability === "Away" || availability === "BeRightBack") return "Away";
  if (availability === "Busy" || availability === "DoNotDisturb") return "Busy";
  if (availability === "Offline" || availability === "PresenceUnknown") return "Offline";
  return "Active";
}
