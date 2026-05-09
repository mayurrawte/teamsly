"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Settings, LogOut } from "lucide-react";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { avatarInitials } from "@/lib/utils/avatar";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { UserProfilePopover } from "@/components/profile/UserProfilePopover";

export function UserFooter() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const name = session?.user?.name ?? "User";
  const email = session?.user?.email ?? undefined;
  const initials = avatarInitials(name);

  return (
    <>
      <div className="flex items-center justify-between border-t border-[#3f4144] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <UserProfilePopover userId={email ?? name} displayName={name} email={email}>
            <button type="button" className="relative flex h-9 w-9 flex-shrink-0">
              <Avatar userId={email ?? name} displayName={name} size={36} />
              <PresenceDot availability="Available" />
            </button>
          </UserProfilePopover>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[13px] font-semibold text-white">{name}</p>
            <p className="text-[11px] text-[#2bac76]">● Active</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Settings"
            aria-label="Open settings"
            onClick={() => setOpen(true)}
            className="rounded p-1 text-[#ababad] hover:bg-[#27292d] hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded p-1 text-[#ababad] hover:bg-[#27292d] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SettingsModal
        open={open}
        onOpenChange={setOpen}
        account={{ name, email, initials }}
        onSignOut={() => signOut({ callbackUrl: "/" })}
      />
    </>
  );
}
