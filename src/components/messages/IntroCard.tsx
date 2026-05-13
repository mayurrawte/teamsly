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
    <div className="mx-4 mb-4 mt-4 rounded-lg border border-[var(--border)]/50 bg-[var(--content-bg)] px-5 py-4">
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/20">
        <Hash className="h-5 w-5 text-[var(--accent)]" />
      </div>
      <h2 className="mb-1 text-[17px] font-bold text-white">#{channelName}</h2>
      {createdDateTime ? (
        <p className="mb-1 text-[13px] text-[var(--text-secondary)]">
          This channel was created on {formatDate(createdDateTime)}. This is the very beginning of{" "}
          <span className="font-medium text-[var(--text-primary)]">#{channelName}</span>.
        </p>
      ) : (
        <p className="mb-1 text-[13px] text-[var(--text-secondary)]">
          This is the very beginning of{" "}
          <span className="font-medium text-[var(--text-primary)]">#{channelName}</span>.
        </p>
      )}
      {description && (
        <p className="mb-3 text-[13px] text-[var(--text-secondary)]">{description}</p>
      )}
      <button
        type="button"
        className="mt-2 flex items-center gap-2 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-[13px] text-[var(--text-primary)] transition-colors hover:border-[var(--text-muted)] hover:bg-[var(--surface-raised)] focus-ring"
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
      <div className="mx-4 mb-4 mt-4 rounded-lg border border-[var(--border)]/50 bg-[var(--content-bg)] px-5 py-4">
        <div className="mb-2.5 flex -space-x-2">
          {displayMembers.slice(0, 2).map((m) => (
            <Avatar
              key={m.id}
              userId={m.userId ?? m.id}
              displayName={m.displayName}
              size={36}
            />
          ))}
        </div>
        <h2 className="mb-1 text-[17px] font-bold text-white">{label}</h2>
        <p className="text-[13px] text-[var(--text-secondary)]">
          This is your space. Draft messages, jot ideas, or keep notes — just for you.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 mt-4 rounded-lg border border-[var(--border)]/50 bg-[var(--content-bg)] px-5 py-4">
      <div className="mb-2.5 flex -space-x-2">
        {displayMembers.slice(0, 3).map((m) => (
          <div key={m.id} className="ring-2 ring-[var(--content-bg)]" style={{ borderRadius: 4 }}>
            <Avatar
              userId={m.userId ?? m.id}
              displayName={m.displayName}
              size={36}
            />
          </div>
        ))}
      </div>
      <h2 className="mb-1 text-[17px] font-bold text-white">{label}</h2>
      <p className="mb-3 text-[13px] text-[var(--text-secondary)]">
        This conversation is just between{" "}
        <span className="font-medium text-[var(--text-primary)]">{label}</span> and you.
      </p>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-[13px] text-[var(--text-primary)] transition-colors hover:border-[var(--text-muted)] hover:bg-[var(--surface-raised)] focus-ring"
      >
        View Profile
      </button>
    </div>
  );
}
