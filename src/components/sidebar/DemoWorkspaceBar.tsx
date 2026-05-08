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
