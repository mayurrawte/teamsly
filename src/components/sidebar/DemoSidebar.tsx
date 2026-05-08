"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Settings, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { SearchModal } from "@/components/modals/SearchModal";

export function DemoSidebar() {
  const { teams, activeTeamId, channels, chats, messages, setActiveChannel, setActiveChat, activeChannelId, activeChatId } =
    useWorkspaceStore();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];

  return (
    <div className="flex w-[260px] flex-shrink-0 flex-col overflow-hidden bg-[#19171d]">
      <div className="flex h-[49px] items-center justify-between border-b border-[#3f4144] px-4 hover:bg-[#27242c]">
        <span className="truncate text-[15px] font-black text-white">
          {activeTeam?.displayName ?? "Teamsly"}
        </span>
        <ChevronDown className="h-4 w-4 text-[#ababad]" />
      </div>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="mx-3 my-2 flex h-7 items-center gap-2 rounded-md border border-[#565856] bg-[#2c2d30] px-2 text-left text-[13px] text-[#ababad] [transition:border-color_150ms_ease,background_150ms_ease] hover:border-white hover:bg-[#1a1d21] focus:border-white focus:bg-[#1a1d21] focus:outline-none"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Search...</span>
      </button>

      <div className="flex-1 overflow-y-auto pb-2">
        <div className="mb-1">
          <button
            onClick={() => setChannelsOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-4 py-1 text-[13px] font-semibold text-[#ababad] hover:text-white"
          >
            {channelsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Channels
          </button>

          {channelsOpen &&
            teamChannels.map((ch) => (
              <SidebarItem
                key={ch.id}
                label={ch.displayName}
                icon={
                  ch.membershipType === "private" ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Hash className="h-3.5 w-3.5" />
                  )
                }
                active={activeChannelId === ch.id}
                onClick={() => setActiveChannel(ch.id)}
              />
            ))}
        </div>

        <div className="mt-3">
          <button
            onClick={() => setDmsOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-4 py-1 text-[13px] font-semibold text-[#ababad] hover:text-white"
          >
            {dmsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Direct Messages
          </button>

          {dmsOpen &&
            chats.map((chat) => {
              const label =
                chat.topic ?? chat.members?.map((m) => m.displayName).join(", ") ?? "DM";
              return (
                <SidebarItem
                  key={chat.id}
                  label={label}
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  active={activeChatId === chat.id}
                  onClick={() => setActiveChat(chat.id)}
                />
              );
            })}
        </div>
      </div>

      {/* Mock user footer */}
      <div className="flex items-center justify-between border-t border-[#3f4144] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#1164a3] text-xs font-bold text-white">
            YO
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[13px] font-semibold text-white">You (Demo)</p>
            <p className="text-[11px] text-[#2bac76]">● Active</p>
          </div>
        </div>
        <button
          type="button"
          title="Settings"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className="rounded p-1 text-[#ababad] hover:bg-[#27292d] hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        account={{ name: "You (Demo)", initials: "YO", badge: "Demo session" }}
      />
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        teamName={activeTeam?.displayName ?? "Teamsly"}
        channels={teamChannels}
        chats={chats}
        messages={messages}
      />
    </div>
  );
}

function SidebarItem({
  label, icon, active, onClick,
}: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-1 text-[15px] transition",
        active ? "bg-[#1164a3] text-white" : "text-[#ababad] hover:bg-[#27292d] hover:text-white"
      )}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
