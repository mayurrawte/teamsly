"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockMessages } from "@/lib/mock/data";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { ChannelMessageHeader, type Tab } from "./MessageHeader";
import { ChannelIntroCard } from "./IntroCard";
import { useMemberPanelStore } from "@/store/memberPanel";
import { openTeamsChannelMeeting } from "@/lib/utils/teams-deeplink";
import { ForwardMessageModal, type ForwardDestination } from "@/components/modals/ForwardMessageModal";
import { useToastStore } from "@/store/toasts";

export function DemoChannelView({ channelId }: { channelId: string }) {
  const { activeTeamId, channels, getMessages, setMessages, appendPendingMessage, replaceMessage, toggleReaction, pendingAnchorMessageId, setPendingAnchorMessageId } = useWorkspaceStore();
  const openChannelMembers = useMemberPanelStore((s) => s.openChannelMembers);
  const handleOpenMembers = () => openChannelMembers("demo", channelId);
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const showToast = useToastStore((s) => s.showToast);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const channel = teamChannels.find((c) => c.id === channelId);

  const contextId = `demo:${channelId}`;
  const messages = getMessages(contextId);
  // Demo anchor: DemoSidebar stashes the target message id in the workspace
  // store (demo has no URL routing). Forward it to MessageFeed and clear it
  // once consumed so a later channel switch doesn't re-flash a stale row.
  const handleAnchorConsumed = useCallback(() => {
    if (pendingAnchorMessageId) setPendingAnchorMessageId(null);
  }, [pendingAnchorMessageId, setPendingAnchorMessageId]);

  useEffect(() => {
    const msgs = mockMessages[channelId] ?? [];
    setMessages(contextId, msgs);
    setActiveTab("messages");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Demo forward — local-only append to the destination's `demo:` cache slice.
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
        id: `demo-${Date.now()}`,
        createdDateTime: now,
        body: { contentType: "text", content },
        from: { user: { id: "you", displayName: "You" } },
        reactions: [],
      });
    }, 400);
  }

  const introCard = channel ? (
    <ChannelIntroCard
      channelName={channel.displayName}
      description={channel.description}
    />
  ) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <ChannelMessageHeader
        name={channel?.displayName ?? channelId}
        description={channel?.description}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenMembers={handleOpenMembers}
        onMeetNow={() => openTeamsChannelMeeting(channel?.displayName ?? "Channel meeting")}
        onVideoMeetNow={() => openTeamsChannelMeeting(channel?.displayName ?? "Channel meeting")}
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
            contextName={channel?.displayName ? `#${channel.displayName}` : "Channel"}
            introCard={introCard}
            anchorMessageId={pendingAnchorMessageId ?? undefined}
            onAnchorConsumed={handleAnchorConsumed}
            onReplyInThread={setThreadMessage}
            onForward={setForwardMessage}
            onToggleReaction={(messageId, reactionType) =>
              toggleReaction(contextId, messageId, reactionType)
            }
          />
          <MessageInput
            placeholder={`Message #${channel?.displayName ?? "channel"}`}
            onSend={handleSend}
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
