"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeSync } from "@/components/layout/ThemeSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeSync />
      {children}
    </SessionProvider>
  );
}
