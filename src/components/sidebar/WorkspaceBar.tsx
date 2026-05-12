"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { MultiTenantSwitcher } from "./MultiTenantSwitcher";
import { useToastStore } from "@/store/toasts";

export function WorkspaceBar() {
  const { teams, activeTeamId, channels, unreadCounts, setTeams, setActiveTeam, setChannels, setActiveChannel } = useWorkspaceStore();
  const showToast = useToastStore((state) => state.showToast);
  const router = useRouter();

  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch("/api/teams");
        if (!response.ok) throw new Error("Failed to load teams");
        const data = (await response.json()) as MSTeam[];
        const sorted = [...data].sort((a, b) => a.displayName.localeCompare(b.displayName));
        setTeams(sorted);
        if (sorted.length > 0 && !useWorkspaceStore.getState().activeTeamId) {
          setActiveTeam(sorted[0].id);
        }
      } catch {
        showToast({ title: "Could not load teams", tone: "error" });
      }
    }

    loadTeams();
  }, [setActiveTeam, setTeams, showToast]);

  useEffect(() => {
    if (!activeTeamId) return;
    const teamId = activeTeamId;
    async function loadChannels() {
      try {
        const response = await fetch(`/api/channels/${teamId}`);
        if (!response.ok) throw new Error("Failed to load channels");
        const data = (await response.json()) as MSChannel[];
        setChannels(teamId, data);
      } catch {
        showToast({ title: "Could not load channels", tone: "error" });
      }
    }

    loadChannels();
  }, [activeTeamId, setChannels, showToast]);

  // Alphabetically sorted teams for display
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [teams]
  );

  function handleTeamClick(teamId: string) {
    setActiveTeam(teamId);
    const teamChannels = useWorkspaceStore.getState().channels[teamId] ?? [];
    if (teamChannels.length > 0) {
      const firstChannel = teamChannels[0];
      setActiveChannel(firstChannel.id);
      router.push(`/app/t/${teamId}/${firstChannel.id}`);
    }
    // If channels aren't loaded yet they'll be fetched by the useEffect above;
    // navigation will happen once the user explicitly picks a channel from the sidebar.
  }

  return (
    <div className="flex w-[64px] flex-col items-center gap-2 overflow-y-auto bg-[#19171d] py-3">
      {sortedTeams.map((team) => {
        const isActive = activeTeamId === team.id;
        return (
          <button
            key={team.id}
            title={team.displayName}
            onClick={() => handleTeamClick(team.id)}
            aria-label={team.displayName}
            aria-pressed={isActive}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-[14px] text-sm font-bold [transition:border-radius_200ms_ease,background-color_150ms_ease,box-shadow_150ms_ease]",
              isActive
                ? "rounded-lg bg-[#1164a3] text-white shadow-[0_0_0_2px_white]"
                : "bg-[#3f0e40] text-white hover:rounded-lg hover:bg-[#5c1e5e]"
            )}
          >
            {getTeamInitials(team.displayName)}
            {teamHasUnread(team.id, channels, unreadCounts) && !isActive && (
              <span className="absolute bottom-[-2px] left-[-2px] h-2 w-2 rounded-full border-2 border-[#19171d] bg-white" />
            )}
          </button>
        );
      })}
      <MultiTenantSwitcher />
    </div>
  );
}

function teamHasUnread(
  teamId: string,
  channels: Record<string, MSChannel[]>,
  unreadCounts: Record<string, number>
): boolean {
  return (channels[teamId] ?? []).some((channel) => (unreadCounts[channel.id] ?? 0) > 0);
}

function getTeamInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}
