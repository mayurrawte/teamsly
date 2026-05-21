import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { VoiceRoomProvider } from "@/components/voice/VoiceRoomProvider";
import { VoiceRoomWidget } from "@/components/voice/VoiceRoomWidget";
import { AutoStatusMount } from "@/components/AutoStatusMount";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/");
  return (
    <VoiceRoomProvider>
      <AutoStatusMount />
      <AppShell>{children}</AppShell>
      <VoiceRoomWidget />
    </VoiceRoomProvider>
  );
}
