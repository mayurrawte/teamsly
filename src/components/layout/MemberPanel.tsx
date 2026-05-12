"use client";

import { X, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { useMemberPanelStore } from "@/store/memberPanel";
import { useWorkspaceStore } from "@/store/workspace";

// TODO: wire /teams/{teamId}/channels/{channelId}/members endpoint to populate real channel members.
// For now we use a stub that renders the loading state layout so the panel dimensions exist.

export function MemberPanel() {
  const { open, view, selectedMember, close } = useMemberPanelStore();
  const presenceMap = useWorkspaceStore((s) => s.presenceMap);

  if (!open) return null;

  return (
    <aside
      aria-label="Members panel"
      className="flex w-[300px] flex-shrink-0 flex-col border-l border-[#3f4144] bg-[#1a1d21]"
    >
      {view === "channel-members" ? (
        <ChannelMembersView onClose={close} />
      ) : (
        selectedMember && (
          <MemberProfileView
            member={selectedMember}
            availability={
              presenceMap[(selectedMember.userId ?? selectedMember.id) ?? ""] ?? "Offline"
            }
            onClose={close}
          />
        )
      )}
    </aside>
  );
}

function ChannelMembersView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[#3f4144] px-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#ababad]" />
          <span className="text-sm font-bold text-white">Members</span>
        </div>
        <button
          type="button"
          aria-label="Close members panel"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Stub — real members will be loaded from /teams/{teamId}/channels/{channelId}/members */}
        <p className="text-center text-sm text-[#6c6f75]">Loading members&hellip;</p>
      </div>
    </>
  );
}

function MemberProfileView({
  member,
  availability,
  onClose,
}: {
  member: MSChatMember;
  availability: MSPresence["availability"];
  onClose: () => void;
}) {
  const userId = member.userId ?? member.id ?? "";

  return (
    <>
      <div className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[#3f4144] px-4">
        <span className="text-sm font-bold text-white">Profile</span>
        <button
          type="button"
          aria-label="Close profile panel"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <div className="relative">
          <Avatar userId={userId} displayName={member.displayName} size={36} className="!h-16 !w-16" />
          <PresenceDot availability={availability} />
        </div>

        <div className="w-full text-center">
          <h3 className="truncate text-lg font-black text-white">{member.displayName}</h3>
          {member.email && (
            <p className="truncate text-sm text-[#ababad]">{member.email}</p>
          )}
          <p className="mt-1 text-xs text-[#2bac76]">{presenceLabel(availability)}</p>
        </div>
      </div>
    </>
  );
}

function presenceLabel(availability: MSPresence["availability"]): string {
  if (availability === "Away" || availability === "BeRightBack") return "Away";
  if (availability === "Busy" || availability === "DoNotDisturb") return "Busy";
  if (availability === "Offline" || availability === "PresenceUnknown") return "Offline";
  return "Active";
}
