"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Settings, LogOut } from "lucide-react";
import { PreferencesModal } from "@/components/modals/PreferencesModal";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { UserProfilePopover } from "@/components/profile/UserProfilePopover";
import { useWorkspaceStore } from "@/store/workspace";

export function UserFooter() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const currentUserId = useWorkspaceStore((state) => state.currentUserId);
  const presence = useWorkspaceStore((state) => state.presenceMap[currentUserId] ?? "Available");

  const name = session?.user?.name ?? "User";
  const email = session?.user?.email ?? undefined;

  return (
    <>
      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <UserProfilePopover userId={currentUserId || "me"} displayName={name} email={email} availability={presence}>
            <button type="button" className="relative flex h-9 w-9 flex-shrink-0 focus-ring rounded">
              <Avatar userId={currentUserId || "me"} displayName={name} size={36} />
              <PresenceDot availability={presence} />
            </button>
          </UserProfilePopover>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[13px] font-semibold text-white">{name}</p>
            <p className="text-[11px] text-[var(--status-online)]">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Settings"
            aria-label="Open settings"
            onClick={() => setOpen(true)}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-white focus-ring"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-white focus-ring"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <PreferencesModal open={open} onOpenChange={setOpen} />
    </>
  );
}
