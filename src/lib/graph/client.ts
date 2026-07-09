import { Client } from "@microsoft/microsoft-graph-client";
import { decodeGraphId } from "@/lib/realtime/ids";

export function getGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export async function getTeams(accessToken: string) {
  const client = getGraphClient(accessToken);
  const res = await client.api("/me/joinedTeams").select("id,displayName,description").get();
  return res.value as MSTeam[];
}

export async function getChannels(accessToken: string, teamId: string) {
  const client = getGraphClient(accessToken);
  const res = await client
    .api(`/teams/${teamId}/channels`)
    .select("id,displayName,description,membershipType")
    .get();
  return res.value as MSChannel[];
}

export async function getChannelMembers(
  accessToken: string,
  teamId: string,
  channelId: string
) {
  const client = getGraphClient(accessToken);
  // No $select — userId is on the derived type; selecting it causes 400 on some tenants.
  const res = await client
    .api(`/teams/${teamId}/channels/${channelId}/members`)
    .get();
  return res.value as MSChannelMember[];
}

export async function getMessages(accessToken: string, teamId: string, channelId: string) {
  const client = getGraphClient(accessToken);
  const res = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages`)
    .top(50)
    .get();
  return res.value as MSMessage[];
}

export async function sendMessage(
  accessToken: string,
  teamId: string,
  channelId: string,
  content: string,
  /**
   * Optional Graph `mentions[]` array, already built server-side from the
   * client's `{ id, name }[]` list — see `lib/graph/mentions.ts`. When
   * present, the body should already contain the matching `<at id="i">…</at>`
   * markup; otherwise Graph errors with `Mention id X must be referenced in
   * the message body`.
   */
  mentions?: unknown[],
  /** Graph body contentType. Use "text" for disappearing messages so the
   *  encrypted blob isn't HTML-wrapped/escaped (mirrors sendChatMessage). */
  contentType: "html" | "text" = "html"
) {
  const client = getGraphClient(accessToken);
  const payload: Record<string, unknown> = {
    body: { content, contentType },
  };
  if (mentions?.length) {
    payload.mentions = mentions;
  }
  return client.api(`/teams/${teamId}/channels/${channelId}/messages`).post(payload);
}

/** Soft-delete a channel message (Graph has no HTTP DELETE — only the
 *  softDelete action). Only the author may delete; others get 403. */
export async function softDeleteChannelMessage(
  accessToken: string,
  teamId: string,
  channelId: string,
  messageId: string
) {
  const client = getGraphClient(accessToken);
  return client
    .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/softDelete`)
    .post({});
}

export async function sendChannelReply(
  accessToken: string,
  teamId: string,
  channelId: string,
  messageId: string,
  content: string
) {
  const client = getGraphClient(accessToken);
  return client.api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`).post({
    body: { content, contentType: "html" },
  });
}

export interface ChatsPage {
  chats: MSChat[];
  nextLink: string | null;
}

export async function getChats(
  accessToken: string,
  options: { pageSize?: number; nextLink?: string } = {}
): Promise<ChatsPage> {
  const client = getGraphClient(accessToken);
  const { pageSize = 20, nextLink } = options;

  // Graph silently ignores $expand=members on /me/chats for some tenants
  // but does return partial member data on others, so we keep it as a
  // best-effort. The sidebar falls back to per-chat lazy fetches for any
  // chat where members come back empty.
  const res = nextLink
    ? await client.api(nextLink).get()
    : await client
        .api("/me/chats")
        .select("id,chatType,topic,lastUpdatedDateTime,lastMessagePreview,viewpoint")
        .top(pageSize)
        .get();

  return {
    chats: res.value as MSChat[],
    nextLink: (res["@odata.nextLink"] as string | undefined) ?? null,
  };
}

// Callers pass chat ids in whichever form they hold — raw Graph ids or the
// still-percent-encoded route param. Normalize before encoding for the Graph
// path (the SDK transmits it verbatim); encoding an already-encoded id twice
// makes Graph 404 the chat.
function encodeChatId(chatId: string): string {
  return encodeURIComponent(decodeGraphId(chatId) ?? chatId);
}

export async function getChat(accessToken: string, chatId: string): Promise<MSChat> {
  const client = getGraphClient(accessToken);
  // Chat IDs containing '@' (e.g. @unq.gbl.spaces) must be percent-encoded.
  // $expand=members with $select fails on some tenants (Graph rejects userId as
  // a property on the base conversationMember type), so we skip the expand here
  // and let the sidebar fetch members separately via /members.
  return client
    .api(`/me/chats/${encodeChatId(chatId)}`)
    .select("id,chatType,topic,lastUpdatedDateTime,lastMessagePreview")
    .get() as Promise<MSChat>;
}

export async function getChatMessages(accessToken: string, chatId: string) {
  const client = getGraphClient(accessToken);
  const res = await client
    .api(`/me/chats/${encodeChatId(chatId)}/messages`)
    .top(50)
    .get();
  return res.value as MSMessage[];
}

export async function getChatMembers(accessToken: string, chatId: string) {
  const client = getGraphClient(accessToken);
  // Don't use $select — userId/email are on the derived aadUserConversationMember
  // type, not the base conversationMember, so selecting them causes a 400.
  const res = await client
    .api(`/me/chats/${encodeChatId(chatId)}/members`)
    .get();
  return res.value as MSChatMember[];
}

export interface ChatAttachment {
  id: string;
  contentType: "reference";
  contentUrl: string;
  name: string;
}

export async function sendChatMessage(
  accessToken: string,
  chatId: string,
  content: string,
  attachments?: ChatAttachment[],
  /**
   * Optional Graph `mentions[]` array — see `lib/graph/mentions.ts`. When
   * present, the body must contain `<at id="i">…</at>` markup for each
   * entry or Graph rejects the request.
   */
  mentions?: unknown[],
  /**
   * Graph body contentType. Use "text" for disappearing messages so the
   * encrypted blob is stored and returned verbatim without HTML wrapping.
   * Defaults to "html" for all normal messages.
   */
  contentType: "html" | "text" = "html"
) {
  const client = getGraphClient(accessToken);
  const payload: Record<string, unknown> = {
    body: { content, contentType },
  };
  if (attachments?.length) {
    payload.attachments = attachments;
  }
  if (mentions?.length) {
    payload.mentions = mentions;
  }
  return client.api(`/me/chats/${chatId}/messages`).post(payload);
}

export async function replyToChatMessage(
  accessToken: string,
  chatId: string,
  messageId: string,
  content: string
) {
  const client = getGraphClient(accessToken);
  return client.api(`/chats/${chatId}/messages/replyWithQuote`).post({
    messageIds: [messageId],
    replyMessage: {
      body: { content, contentType: "html" },
    },
  });
}

export async function setChannelMessageReaction(
  accessToken: string,
  teamId: string,
  channelId: string,
  messageId: string,
  reactionType: string
) {
  const client = getGraphClient(accessToken);
  await client.api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/setReaction`).post({
    reactionType,
  });
}

export async function unsetChannelMessageReaction(
  accessToken: string,
  teamId: string,
  channelId: string,
  messageId: string,
  reactionType: string
) {
  const client = getGraphClient(accessToken);
  await client.api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/unsetReaction`).post({
    reactionType,
  });
}

export async function setChatMessageReaction(
  accessToken: string,
  chatId: string,
  messageId: string,
  reactionType: string
) {
  const client = getGraphClient(accessToken);
  await client.api(`/chats/${chatId}/messages/${messageId}/setReaction`).post({
    reactionType,
  });
}

export async function unsetChatMessageReaction(
  accessToken: string,
  chatId: string,
  messageId: string,
  reactionType: string
) {
  const client = getGraphClient(accessToken);
  await client.api(`/chats/${chatId}/messages/${messageId}/unsetReaction`).post({
    reactionType,
  });
}

export async function getPresence(accessToken: string, userIds: string[]) {
  const client = getGraphClient(accessToken);
  const res = await client.api("/communications/getPresencesByUserId").post({ ids: userIds });
  return res.value as MSPresence[];
}

export async function getMe(accessToken: string) {
  const client = getGraphClient(accessToken);
  return client.api("/me").select("id,displayName,mail,userPrincipalName").get() as Promise<MSUser>;
}

export interface PersonResult {
  id: string;
  displayName: string;
  email: string;
}

// Org directory search by name. Uses /users $search (needs the eventual
// ConsistencyLevel header + $count for advanced queries), so it finds anyone
// in the tenant — not just people the user has already chatted with.
export async function searchPeople(
  accessToken: string,
  query: string
): Promise<PersonResult[]> {
  const client = getGraphClient(accessToken);
  // Strip double-quotes so they can't break out of the KQL search string.
  const q = query.replace(/"/g, "").trim();
  if (!q) return [];
  const res = await client
    .api("/users")
    .header("ConsistencyLevel", "eventual")
    .query({ $count: "true" })
    .search(`"displayName:${q}" OR "mail:${q}"`)
    .select("id,displayName,mail,userPrincipalName")
    .top(10)
    .get();
  const users = (res.value ?? []) as Array<{
    id: string;
    displayName: string;
    mail?: string;
    userPrincipalName?: string;
  }>;
  return users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: u.mail ?? u.userPrincipalName ?? "",
  }));
}

// Find-or-create a 1:1 chat with a user. Graph is idempotent for oneOnOne
// chats: it returns the existing chat if one already exists, else creates it.
export async function getOrCreateOneOnOneChat(
  accessToken: string,
  myId: string,
  userId: string
): Promise<MSChat> {
  const client = getGraphClient(accessToken);
  return client.api("/chats").post({
    chatType: "oneOnOne",
    members: [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${myId}')`,
      },
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${userId}')`,
      },
    ],
  }) as Promise<MSChat>;
}

export async function createGroupChat(
  accessToken: string,
  myId: string,
  userIds: string[],
  topic?: string
): Promise<MSChat> {
  const client = getGraphClient(accessToken);
  const members = [myId, ...userIds].map((id) => ({
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: ["owner"],
    "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${id}')`,
  }));
  const body: Record<string, unknown> = { chatType: "group", members };
  const trimmed = topic?.trim();
  if (trimmed) body.topic = trimmed;
  return client.api("/chats").post(body) as Promise<MSChat>;
}

// ---------------------------------------------------------------------------
// Large-file upload via Graph createUploadSession (resumable, chunked).
//
// Graph spec: https://learn.microsoft.com/graph/api/driveitem-createuploadsession
// Chunk size must be a multiple of 320 KiB. We use 5 MiB — large enough to
// minimise round-trips, small enough to keep memory pressure bounded.
// ---------------------------------------------------------------------------

export interface DriveUploadItem {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  file?: { mimeType: string };
}

const CHUNK_BYTES = 5 * 1024 * 1024; // 5 MiB — multiple of 320 KiB per Graph spec

export class GraphUploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GraphUploadError";
  }
}

/**
 * Upload a Buffer to OneDrive via createUploadSession + chunked PUTs.
 *
 * `itemPath` is the drive path relative to the user's root, e.g.
 * `/Apps/Teamsly/photo.png` (no leading drive prefix). The function adds the
 * `/me/drive/root:` prefix and the `:/createUploadSession` action.
 *
 * On any non-2xx response we DELETE the upload session URL to free Graph's
 * server-side state, then surface a GraphUploadError to the caller.
 */
export async function uploadLargeFileToOneDrive(
  accessToken: string,
  itemPath: string,
  data: ArrayBuffer,
  contentType: string
): Promise<DriveUploadItem> {
  const total = data.byteLength;

  // 1. Create the upload session.
  const createUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${itemPath}:/createUploadSession`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
        name: decodeURIComponent(itemPath.split("/").pop() ?? "file"),
      },
    }),
  });

  if (!createRes.ok) {
    throw new GraphUploadError(
      `createUploadSession failed (${createRes.status})`,
      createRes.status
    );
  }

  const { uploadUrl } = (await createRes.json()) as { uploadUrl?: string };
  if (!uploadUrl) {
    throw new GraphUploadError("createUploadSession returned no uploadUrl", 502);
  }

  // 2. Stream chunks. Each PUT carries Content-Range bytes start-end/total.
  //    Intermediate chunks return 202 + nextExpectedRanges; the final chunk
  //    returns 200/201 with the completed driveItem JSON.
  const bytes = new Uint8Array(data);
  let offset = 0;

  try {
    while (offset < total) {
      const end = Math.min(offset + CHUNK_BYTES, total);
      const chunk = bytes.subarray(offset, end);
      const chunkLen = end - offset;

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunkLen),
          "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
          "Content-Type": contentType,
        },
        body: chunk,
      });

      if (putRes.status === 202) {
        // Intermediate chunk accepted — body is { expirationDateTime,
        // nextExpectedRanges }, which we trust and ignore (we always send
        // contiguous ranges from offset 0 upwards).
        offset = end;
        continue;
      }

      if (putRes.status === 200 || putRes.status === 201) {
        // Final chunk — body is the completed driveItem.
        return (await putRes.json()) as DriveUploadItem;
      }

      throw new GraphUploadError(
        `chunk PUT failed at ${offset}-${end - 1} (${putRes.status})`,
        putRes.status
      );
    }

    // Reached only if total === 0, which is rejected earlier.
    throw new GraphUploadError("upload completed without final response", 502);
  } catch (err) {
    // Best-effort cancel of the session so Graph reclaims server state.
    try {
      await fetch(uploadUrl, { method: "DELETE" });
    } catch {
      // ignore
    }
    throw err;
  }
}
