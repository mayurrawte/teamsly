"use client";

import { useAutoStatus } from "@/hooks/useAutoStatus";

export function AutoStatusMount() {
  useAutoStatus();
  return null;
}
