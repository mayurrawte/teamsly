"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CatchUpContent } from "@/components/ai/CatchUpContent";
import { FirstRunWelcome } from "./FirstRunWelcome";
import { UnreadFallback } from "./UnreadFallback";

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export function WorkspaceHome() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];
  const [greeting, setGreeting] = useState("Welcome back");

  // Client-only so the hour doesn't cause a hydration mismatch.
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto px-6 py-8">
      <header className="mb-5 flex-shrink-0">
        <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <FirstRunWelcome />

      <div className="flex min-h-0 flex-1 flex-col">
        {AI_ENABLED ? <CatchUpContent /> : <UnreadFallback />}
      </div>
    </div>
  );
}
