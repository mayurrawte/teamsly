"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { MultiTenantSwitcher } from "./MultiTenantSwitcher";
import { useToastStore } from "@/store/toasts";

export function WorkspaceBar() {
  const { teams, activeTeamId, channels, unreadCounts, setTeams, setActiveTeam, setChannels } = useWorkspaceStore();
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch("/api/teams");
        if (!response.ok) throw new Error("Failed to load teams");
        const data = (await response.json()) as MSTeam[];
        setTeams(data);
        if (data.length > 0 && !useWorkspaceStore.getState().activeTeamId) {
          setActiveTeam(data[0].id);
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

  return (
    <div className="flex w-[68px] flex-col items-center gap-2 overflow-y-auto bg-[#19171d] py-3">
      {teams.map((team) => (
        <button
          key={team.id}
          title={team.displayName}
          onClick={() => setActiveTeam(team.id)}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-[14px] text-sm font-bold [transition:border-radius_200ms_ease,background-color_150ms_ease]",
            activeTeamId === team.id
              ? "rounded-lg bg-[#1164a3] text-white"
              : "bg-[#3f0e40] text-white hover:rounded-lg"
          )}
        >
          {team.displayName.slice(0, 2).toUpperCase()}
          {teamHasUnread(team.id, channels, unreadCounts) && activeTeamId !== team.id && (
            <span className="absolute bottom-[-2px] left-[-2px] h-2 w-2 rounded-full border-2 border-[#19171d] bg-white" />
          )}
        </button>
      ))}
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
