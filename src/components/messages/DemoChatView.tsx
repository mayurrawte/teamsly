"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockChatMessages } from "@/lib/mock/data";
import { openTeamsCall } from "@/lib/utils/teams-deeplink";
import { getChatLabel } from "@/lib/utils/chat-label";
import { textToHtml } from "@/lib/utils/render-message";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { DmMessageHeader, type Tab } from "./MessageHeader";
import { DmIntroCard } from "./IntroCard";

export function DemoChatView({ chatId }: { chatId: string }) {
  const { chats, getMessages, setMessages, appendPendingMessage, replaceMessage, toggleReaction, deleteMessage, editMessage } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const chat = chats.find((c) => c.id === chatId);
  const members = chat?.members ?? [];
  const currentUserId = "you";
  const label = getChatLabel(chat, currentUserId);

  const contextId = `demo:${chatId}`;
  const messages = getMessages(contextId);

  useEffect(() => {
    setMessages(contextId, mockChatMessages[chatId] ?? []);
    setActiveTab("messages");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  function handleDelete(messageId: string) {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    deleteMessage(contextId, messageId);
  }

  function handleEdit(messageId: string, newContent: string) {
    editMessage(contextId, messageId, textToHtml(newContent));
  }

  async function handleSend(content: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    appendPendingMessage(contextId, {
      id: tempId,
      createdDateTime: now,
      body: { contentType: "text", content },
      from: { user: { id: "you", displayName: "You" } },
      reactions: [],
    });
    // Simulate server round-trip with a small delay so the pending state is visible.
    window.setTimeout(() => {
      replaceMessage(contextId, tempId, {
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

  // @mention candidates for demo — all members except self
  const mentionCandidates = otherMembers.map((m) => ({
    id: m.userId ?? m.id,
    displayName: m.displayName,
    email: m.email,
  }));

  const callIdentifiers = otherMembers
    .map((m) => m.email ?? m.userId ?? m.id ?? "")
    .filter(Boolean);

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
        {...(callIdentifiers.length > 0 && {
          onCall: () => openTeamsCall(callIdentifiers),
          onVideoCall: () => openTeamsCall(callIdentifiers, { withVideo: true }),
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
            onToggleReaction={(messageId, reactionType) =>
              toggleReaction(contextId, messageId, reactionType)
            }
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
          <MessageInput
            placeholder={`Message ${label}`}
            onSend={handleSend}
            mentionCandidates={mentionCandidates}
          />
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
