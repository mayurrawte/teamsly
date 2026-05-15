"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ForwardMessageModal, type ForwardDestination } from "@/components/modals/ForwardMessageModal";
import { useToastStore } from "@/store/toasts";

export function DemoChatView({ chatId }: { chatId: string }) {
  const { chats, getMessages, setMessages, appendPendingMessage, replaceMessage, toggleReaction, deleteMessage, editMessage, pendingAnchorMessageId, setPendingAnchorMessageId } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const showToast = useToastStore((s) => s.showToast);
  const chat = chats.find((c) => c.id === chatId);
  const members = chat?.members ?? [];
  const currentUserId = "you";
  const label = getChatLabel(chat, currentUserId);

  const contextId = `demo:${chatId}`;
  const messages = getMessages(contextId);
  // Demo anchor: DemoSidebar set `pendingAnchorMessageId` after selecting a
  // message result. Forward to MessageFeed and clear after consumption.
  const handleAnchorConsumed = useCallback(() => {
    if (pendingAnchorMessageId) setPendingAnchorMessageId(null);
  }, [pendingAnchorMessageId, setPendingAnchorMessageId]);

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

  // Demo forward — local-only optimistic append to the destination's
  // `demo:` cache slice, with a 400ms simulated round-trip that mirrors
  // handleSend's pattern.
  async function handleForward(destination: ForwardDestination, htmlBody: string) {
    const destContextId = destination.kind === "chat"
      ? `demo:${destination.chatId}`
      : `demo:${destination.channelId}`;
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    appendPendingMessage(destContextId, {
      id: tempId,
      createdDateTime: now,
      body: { contentType: "html", content: htmlBody },
      from: { user: { id: "you", displayName: "You" } },
      reactions: [],
    });
    window.setTimeout(() => {
      replaceMessage(destContextId, tempId, {
        id: `demo-forward-${Date.now()}`,
        createdDateTime: now,
        body: { contentType: "html", content: htmlBody },
        from: { user: { id: "you", displayName: "You" } },
        reactions: [],
      });
      showToast({ title: `Forwarded to ${destination.label}` });
    }, 400);
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
            bookmarkContextId={contextId}
            contextLabel={label}
            introCard={introCard}
            anchorMessageId={pendingAnchorMessageId ?? undefined}
            onAnchorConsumed={handleAnchorConsumed}
            onReplyInThread={setThreadMessage}
            onForward={setForwardMessage}
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
            contextId={`demo:${chatId}`}
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
        onForward={setForwardMessage}
      />
      <ForwardMessageModal
        open={Boolean(forwardMessage)}
        onOpenChange={(next) => { if (!next) setForwardMessage(null); }}
        message={forwardMessage}
        onForward={handleForward}
      />
    </div>
  );
}
