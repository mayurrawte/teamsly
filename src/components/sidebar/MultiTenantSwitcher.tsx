"use client";

import { Plus, UserRound } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { avatarInitials } from "@/lib/utils/avatar";

interface MultiTenantSwitcherProps {
  demo?: boolean;
}

export function MultiTenantSwitcher({ demo = false }: MultiTenantSwitcherProps) {
  if (process.env.NEXT_PUBLIC_PRO !== "true") return null;

  return (
    <div className="mt-auto flex flex-col items-center gap-2 border-t border-[#3f4144] pt-3">
      {demo ? <DemoAccount /> : <CurrentAccount />}
      <button
        type="button"
        title="Add Microsoft account"
        aria-label="Add Microsoft account"
        onClick={() => {
          if (!demo) signIn("microsoft-entra-id");
        }}
        className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#3f0e40] text-[#ababad] [transition:border-radius_200ms_ease,background-color_150ms_ease] hover:rounded-lg hover:text-white"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function CurrentAccount() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Account";

  return (
    <div
      title={name}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1164a3] text-[12px] font-bold text-white"
    >
      {avatarInitials(name)}
    </div>
  );
}

function DemoAccount() {
  return (
    <div
      title="Demo account"
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1164a3] text-white"
    >
      <UserRound size={17} />
    </div>
  );
}
