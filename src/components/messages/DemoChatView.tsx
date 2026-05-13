"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockChatMessages } from "@/lib/mock/data";
import { openTeamsCall } from "@/lib/utils/teams-deeplink";
import { textToHtml } from "@/lib/utils/render-message";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { DmMessageHeader, type Tab } from "./MessageHeader";
import { DmIntroCard } from "./IntroCard";

export function DemoChatView({ chatId }: { chatId: string }) {
  const { chats, messages, setMessages, appendPendingMessage, replaceMessage, toggleReaction, deleteMessage, editMessage } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const chat = chats.find((c) => c.id === chatId);
  const members = chat?.members ?? [];
  const label = chat?.topic ?? members.map((m) => m.displayName).join(", ") ?? "DM";
  const currentUserId = "you";

  useEffect(() => {
    setMessages(mockChatMessages[chatId] ?? []);
    setActiveTab("messages");
  }, [chatId]);

  function handleDelete(messageId: string) {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    deleteMessage(messageId);
  }

  function handleEdit(messageId: string, newContent: string) {
    editMessage(messageId, textToHtml(newContent));
  }

  async function handleSend(content: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    appendPendingMessage({
      id: tempId,
      createdDateTime: now,
      body: { contentType: "text", content },
      from: { user: { id: "you", displayName: "You" } },
      reactions: [],
    });
    // Simulate server round-trip with a small delay so the pending state is visible.
    window.setTimeout(() => {
      replaceMessage(tempId, {
        id: `demo-dm-${Date.now()}`,
        createdDateTime: now,
        body: { contentType: "text", content },
        from: { user: { id: "you", displayName: "You" } },
        reactions: [],
      });
    }, 400);
  }

  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  const isSelfDm = otherMembers.length === 0;

  const callEmails = otherMembers.map((m) => m.email ?? "").filter(Boolean);

  const introCard = (
    <DmIntroCard
      label={label}
      members={members}
      currentUserId={currentUserId}
      isSelfDm={isSelfDm}
    />
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <DmMessageHeader
        label={label}
        members={members}
        currentUserId={currentUserId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenMembers={undefined}
        {...(callEmails.length > 0 && {
          onCall: () => openTeamsCall(callEmails),
          onVideoCall: () => openTeamsCall(callEmails, { withVideo: true }),
        })}
      />
      {activeTab === "files" ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-[#6c6f75]">
          Files preview is available with a connected Microsoft account.
        </div>
      ) : activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={false}
            contextName={label}
            introCard={introCard}
            onReplyInThread={setThreadMessage}
            onToggleReaction={toggleReaction}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
          <MessageInput placeholder={`Message ${label}`} onSend={handleSend} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
          About — coming soon
        </div>
      )}
      <ThreadPanel
        open={Boolean(threadMessage)}
        message={threadMessage}
        onClose={() => setThreadMessage(null)}
      />
    </div>
  );
}
