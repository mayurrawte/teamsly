"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function UserFooter() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center justify-between border-t border-[#3f4144] px-3 py-2">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#1164a3] text-xs font-bold text-white">
          {session?.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
        </div>
        <div className="overflow-hidden">
          <p className="truncate text-[13px] font-semibold text-white">
            {session?.user?.name ?? "User"}
          </p>
          <p className="text-[11px] text-[#6c6f75]">Active</p>
        </div>
      </div>
      <button
        title="Sign out"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded p-1 text-[#ababad] hover:bg-[#27292d] hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
