"use client";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { WorkspaceBar } from "@/components/sidebar/WorkspaceBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1d21]">
      <WorkspaceBar />
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden bg-[#222529]">
        {children}
      </main>
    </div>
  );
}
