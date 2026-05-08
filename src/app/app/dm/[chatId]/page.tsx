import { ChatView } from "@/components/messages/ChatView";

export default async function DmPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return <ChatView chatId={chatId} />;
}
