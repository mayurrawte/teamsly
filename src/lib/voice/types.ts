export type VoiceRoomTarget = {
  name: string;
  displayName: string;
  /**
   * The chat/channel this room belongs to. The server re-derives the room name
   * from this and verifies the caller is a member of that resource before issuing
   * a token, so a client can't join an arbitrary room just by naming it. Exactly
   * one form should be set (chatId, or teamId+channelId).
   */
  chatId?: string;
  teamId?: string;
  channelId?: string;
};
export type VoiceRoomState = { active: VoiceRoomTarget | null };

/**
 * Canonical voice-room name derived from the resource ids. Shared by the client
 * (VoiceTrigger / active-participant polling) and the server (token route) so
 * both agree on the exact string. Sanitized to the room-name charset.
 */
export function voiceRoomNameFor(ctx: {
  chatId?: string;
  teamId?: string;
  channelId?: string;
}): string {
  const raw = ctx.chatId
    ? `chat-${ctx.chatId}`
    : ctx.teamId && ctx.channelId
      ? `channel-${ctx.teamId}-${ctx.channelId}`
      : "";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-");
}
