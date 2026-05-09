"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { MultiTenantSwitcher } from "./MultiTenantSwitcher";

export function WorkspaceBar() {
  const { teams, activeTeamId, channels, unreadCounts, setTeams, setActiveTeam, setChannels } = useWorkspaceStore();

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data: MSTeam[]) => {
        setTeams(data);
        if (data.length > 0 && !activeTeamId) {
          setActiveTeam(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!activeTeamId) return;
    fetch(`/api/channels/${activeTeamId}`)
      .then((r) => r.json())
      .then((data: MSChannel[]) => setChannels(activeTeamId, data));
  }, [activeTeamId]);

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
