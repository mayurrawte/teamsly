"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { mockChannels } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

export function DemoWorkspaceBar() {
  const { teams, activeTeamId, setActiveTeam, setChannels } = useWorkspaceStore();

  function switchTeam(id: string) {
    setActiveTeam(id);
    setChannels(id, mockChannels[id] ?? []);
  }

  return (
    <div className="flex w-[68px] flex-col items-center gap-2 overflow-y-auto bg-[#19171d] py-3">
      {teams.map((team) => (
        <button
          key={team.id}
          title={team.displayName}
          onClick={() => switchTeam(team.id)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[14px] text-sm font-bold [transition:border-radius_200ms_ease,background-color_150ms_ease]",
            activeTeamId === team.id
              ? "rounded-lg bg-[#1164a3] text-white"
              : "bg-[#3f0e40] text-white hover:rounded-lg"
          )}
        >
          {team.displayName.slice(0, 2).toUpperCase()}
        </button>
      ))}
    </div>
  );
}
