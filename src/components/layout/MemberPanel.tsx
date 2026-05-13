"use client";

import { useEffect, useRef, useState } from "react";
import { X, Users, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { useMemberPanelStore } from "@/store/memberPanel";
import { useWorkspaceStore } from "@/store/workspace";

export function MemberPanel() {
  const { open, view, selectedMember, currentTeamId, currentChannelId, close } =
    useMemberPanelStore();
  const presenceMap = useWorkspaceStore((s) => s.presenceMap);

  if (!open) return null;

  return (
    <aside
      aria-label="Members panel"
      className="flex w-[300px] flex-shrink-0 flex-col border-l border-[var(--border)] bg-[var(--content-bg)]"
    >
      {view === "channel-members" ? (
        <ChannelMembersView
          teamId={currentTeamId ?? ""}
          channelId={currentChannelId ?? ""}
          presenceMap={presenceMap}
          onClose={close}
        />
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

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; members: MSChannelMember[] }
  | { status: "error" };

function ChannelMembersView({
  teamId,
  channelId,
  presenceMap,
  onClose,
}: {
  teamId: string;
  channelId: string;
  presenceMap: Record<string, MSPresence["availability"]>;
  onClose: () => void;
}) {
  const { openMemberProfile } = useMemberPanelStore();
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const cacheRef = useRef<Record<string, MSChannelMember[]>>({});

  const cacheKey = `${teamId}:${channelId}`;

  useEffect(() => {
    if (!teamId || !channelId) return;

    const cached = cacheRef.current[cacheKey];
    if (cached) {
      setState({ status: "success", members: cached });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/channels/${teamId}/${channelId}/members`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MSChannelMember[]>;
      })
      .then((members) => {
        if (cancelled) return;
        cacheRef.current[cacheKey] = members;
        setState({ status: "success", members });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, channelId, cacheKey]);

  function retry() {
    delete cacheRef.current[cacheKey];
    setState({ status: "idle" });
  }

  return (
    <>
      <div className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-[13px] font-bold text-white">
            Members
            {state.status === "success" && state.members.length > 0 && (
              <span className="ml-1.5 text-[12px] font-normal text-[var(--text-muted)]">
                {state.members.length}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close members panel"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {(state.status === "idle" || state.status === "loading") && (
          <p className="mt-4 text-center text-[13px] text-[var(--text-muted)]">
            Loading members&hellip;
          </p>
        )}

        {state.status === "error" && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-[13px] text-[var(--text-muted)]">Couldn&rsquo;t load members</p>
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {state.status === "success" && state.members.length === 0 && (
          <p className="mt-4 text-center text-[13px] text-[var(--text-muted)]">No members found</p>
        )}

        {state.status === "success" && state.members.length > 0 && (
          <ul className="space-y-0.5">
            {state.members.map((member) => {
              const uid = member.userId ?? member.id;
              const availability = presenceMap[uid] ?? undefined;
              const isOwner = member.roles?.includes("owner") ?? false;
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => openMemberProfile({ id: member.id, displayName: member.displayName, userId: member.userId, email: member.email })}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-raised)] focus-ring"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar userId={uid} displayName={member.displayName} size={24} />
                      <PresenceDot availability={availability} />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">
                      {member.displayName}
                    </span>
                    {isOwner && (
                      <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                        Owner
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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
      <div className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <span className="text-[13px] font-bold text-white">Profile</span>
        <button
          type="button"
          aria-label="Close profile panel"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
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
          <h3 className="truncate text-[16px] font-bold text-white">{member.displayName}</h3>
          {member.email && (
            <p className="truncate text-[13px] text-[var(--text-secondary)]">{member.email}</p>
          )}
          <p className="mt-1 text-[12px] text-[var(--status-online)]">{presenceLabel(availability)}</p>
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
