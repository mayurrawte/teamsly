"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";

export function WorkspaceBar() {
  const { teams, activeTeamId, setTeams, setActiveTeam, setChannels } = useWorkspaceStore();

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
            "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all",
            activeTeamId === team.id
              ? "rounded-lg bg-[#1164a3] text-white"
              : "bg-[#3f0e40] text-white hover:rounded-lg hover:bg-[#1164a3]"
          )}
        >
          {team.displayName.slice(0, 2).toUpperCase()}
        </button>
      ))}
    </div>
  );
}
