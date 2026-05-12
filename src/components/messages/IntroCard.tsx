"use client";

import { Hash, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

interface ChannelIntroCardProps {
  channelName: string;
  description?: string;
  createdDateTime?: string;
}

interface DmIntroCardProps {
  label: string;
  members: MSChatMember[];
  currentUserId: string;
  isSelfDm: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ChannelIntroCard({
  channelName,
  description,
  createdDateTime,
}: ChannelIntroCardProps) {
  return (
    <div className="mx-4 mb-6 mt-4 rounded-lg border border-[#3f4144]/50 bg-[#1e2025] px-6 py-5">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F5A8F]/20">
        <Hash className="h-7 w-7 text-[#0F5A8F]" />
      </div>
      <h2 className="mb-1 text-xl font-bold text-white">#{channelName}</h2>
      {createdDateTime ? (
        <p className="mb-1 text-sm text-[#ababad]">
          This channel was created on {formatDate(createdDateTime)}. This is the very beginning of{" "}
          <span className="font-medium text-[#d1d2d3]">#{channelName}</span>.
        </p>
      ) : (
        <p className="mb-1 text-sm text-[#ababad]">
          This is the very beginning of{" "}
          <span className="font-medium text-[#d1d2d3]">#{channelName}</span>.
        </p>
      )}
      {description && (
        <p className="mb-3 text-sm text-[#ababad]">{description}</p>
      )}
      <button
        type="button"
        className="mt-2 flex items-center gap-2 rounded-md border border-[#3f4144] bg-transparent px-3 py-1.5 text-sm text-[#d1d2d3] transition-colors hover:border-[#6c6f75] hover:bg-[#2b2d31] focus:outline-none"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Add People to Channel
      </button>
    </div>
  );
}

export function DmIntroCard({
  label,
  members,
  currentUserId,
  isSelfDm,
}: DmIntroCardProps) {
  const otherMembers = members.filter(
    (m) => (m.userId ?? m.id) !== currentUserId
  );
  const displayMembers = otherMembers.length > 0 ? otherMembers : members;

  if (isSelfDm) {
    return (
      <div className="mx-4 mb-6 mt-4 rounded-lg border border-[#3f4144]/50 bg-[#1e2025] px-6 py-5">
        <div className="mb-3 flex -space-x-2">
          {displayMembers.slice(0, 2).map((m) => (
            <Avatar
              key={m.id}
              userId={m.userId ?? m.id}
              displayName={m.displayName}
              size={36}
            />
          ))}
        </div>
        <h2 className="mb-1 text-xl font-bold text-white">{label}</h2>
        <p className="text-sm text-[#ababad]">
          This is your space. Draft messages, jot ideas, or keep notes — just for you.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-6 mt-4 rounded-lg border border-[#3f4144]/50 bg-[#1e2025] px-6 py-5">
      <div className="mb-3 flex -space-x-2">
        {displayMembers.slice(0, 3).map((m) => (
          <div key={m.id} className="ring-2 ring-[#1e2025]" style={{ borderRadius: 4 }}>
            <Avatar
              userId={m.userId ?? m.id}
              displayName={m.displayName}
              size={36}
            />
          </div>
        ))}
      </div>
      <h2 className="mb-1 text-xl font-bold text-white">{label}</h2>
      <p className="mb-3 text-sm text-[#ababad]">
        This conversation is just between{" "}
        <span className="font-medium text-[#d1d2d3]">{label}</span> and you.
      </p>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-[#3f4144] bg-transparent px-3 py-1.5 text-sm text-[#d1d2d3] transition-colors hover:border-[#6c6f75] hover:bg-[#2b2d31] focus:outline-none"
      >
        View Profile
      </button>
    </div>
  );
}
