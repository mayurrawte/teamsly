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
    <div className="mt-auto flex flex-col items-center gap-2 border-t border-[var(--border)] pt-3">
      {demo ? <DemoAccount /> : <CurrentAccount />}
      <button
        type="button"
        title="Add Microsoft account"
        aria-label="Add Microsoft account"
        onClick={() => {
          if (!demo) signIn("microsoft-entra-id");
        }}
        className="press-snap flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--surface-raised)] text-[var(--text-secondary)] [transition:border-radius_var(--motion-base)_var(--ease-spring),background-color_var(--motion-fast)_var(--ease-out-soft),color_var(--motion-fast)] hover:rounded-lg hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring"
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
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)] text-[12px] font-bold text-[var(--text-white)]"
    >
      {avatarInitials(name)}
    </div>
  );
}

function DemoAccount() {
  return (
    <div
      title="Demo account"
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--text-white)]"
    >
      <UserRound size={17} />
    </div>
  );
}
