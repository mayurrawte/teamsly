"use client";

import { Hash, Phone, Bell, Search, MoreVertical } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

type Tab = "messages" | "files" | "about";

interface ChannelHeaderProps {
  name?: string;
  description?: string;
  memberCount?: number;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onOpenMembers?: () => void;
}

interface DmHeaderProps {
  label: string;
  members: MSChatMember[];
  currentUserId: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onSearchClick?: () => void;
  onOpenMembers?: () => void;
}

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "messages", label: "Messages" },
  { id: "files", label: "Files" },
  { id: "about", label: "About" },
];

function TabRow({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <div className="flex items-end gap-1">
      {TAB_LABELS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={`px-3 py-1 text-sm font-medium transition-colors focus:outline-none ${
            activeTab === id
              ? "border-b-2 border-white text-white"
              : "text-[#ababad] hover:text-[#d1d2d3]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function IconCluster({
  onSearchClick,
  onOpenMembers,
}: {
  onSearchClick?: () => void;
  onOpenMembers?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onSearchClick}
        title="Search"
        className="rounded p-1.5 text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-[#d1d2d3] focus:outline-none"
      >
        <Search className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Call"
        className="rounded p-1.5 text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-[#d1d2d3] focus:outline-none"
      >
        <Phone className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Notifications"
        className="rounded p-1.5 text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-[#d1d2d3] focus:outline-none"
      >
        <Bell className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Members"
        onClick={onOpenMembers}
        className="rounded p-1.5 text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-[#d1d2d3] focus:outline-none"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function MemberAvatarStack({
  members,
  currentUserId,
  onOpenMembers,
}: {
  members: MSChatMember[];
  currentUserId: string;
  onOpenMembers?: () => void;
}) {
  const shown = members.slice(0, 5);
  const overflow = members.length > 5 ? members.length - 5 : 0;
  return (
    <button
      type="button"
      onClick={onOpenMembers}
      title="View members"
      className="flex items-center rounded p-0.5 transition-colors hover:bg-[#2b2d31] focus:outline-none"
    >
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <div key={m.id} className="ring-2 ring-[#1a1d21]" style={{ borderRadius: 4 }}>
            <Avatar
              userId={m.userId ?? m.id}
              displayName={m.displayName}
              size={20}
            />
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="ml-1.5 text-xs text-[#ababad]">+{overflow}</span>
      )}
    </button>
  );
}

export function ChannelMessageHeader({
  name,
  description,
  activeTab,
  onTabChange,
  onSearchClick,
  onOpenMembers,
}: ChannelHeaderProps & { onSearchClick?: () => void }) {
  return (
    <div className="flex flex-col border-b border-[#3f4144] bg-[#1a1d21] px-4 shadow-sm">
      {/* Top row */}
      <div className="flex h-[49px] items-center justify-between gap-4">
        {/* Left: icon + name + description */}
        <div className="flex min-w-0 items-center gap-2">
          <Hash className="h-4 w-4 flex-shrink-0 text-[#ababad]" />
          <span className="truncate font-bold text-white">{name}</span>
          {description && (
            <>
              <span className="text-[#3f4144]">|</span>
              <span className="truncate text-sm text-[#6c6f75]">{description}</span>
            </>
          )}
        </div>
        {/* Right: icon cluster */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <IconCluster onSearchClick={onSearchClick} onOpenMembers={onOpenMembers} />
        </div>
      </div>
      {/* Tab row */}
      <TabRow activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

export function DmMessageHeader({
  label,
  members,
  currentUserId,
  activeTab,
  onTabChange,
  onSearchClick,
  onOpenMembers,
}: DmHeaderProps) {
  const otherMembers = members.filter(
    (m) => (m.userId ?? m.id) !== currentUserId
  );
  const displayMembers = otherMembers.length > 0 ? otherMembers : members;

  return (
    <div className="flex flex-col border-b border-[#3f4144] bg-[#1a1d21] px-4 shadow-sm">
      {/* Top row */}
      <div className="flex h-[49px] items-center justify-between gap-4">
        {/* Left: avatars + name */}
        <div className="flex min-w-0 items-center gap-2">
          {displayMembers.length > 0 ? (
            <MemberAvatarStack
              members={displayMembers.slice(0, 5)}
              currentUserId={currentUserId}
              onOpenMembers={onOpenMembers}
            />
          ) : null}
          <span className="truncate font-bold text-white">{label}</span>
        </div>
        {/* Right: icon cluster */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <IconCluster onSearchClick={onSearchClick} onOpenMembers={onOpenMembers} />
        </div>
      </div>
      {/* Tab row */}
      <TabRow activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

export type { Tab };
