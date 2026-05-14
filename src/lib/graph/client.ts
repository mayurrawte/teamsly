import { Client } from "@microsoft/microsoft-graph-client";

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
  const res = await client
    .api(`/teams/${teamId}/channels/${channelId}/members`)
    .select("id,displayName,email,userId,roles")
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
  content: string
) {
  const client = getGraphClient(accessToken);
  return client.api(`/teams/${teamId}/channels/${channelId}/messages`).post({
    body: { content, contentType: "html" },
  });
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

  const res = nextLink
    ? await client.api(nextLink).get()
    : await client
        .api("/me/chats")
        .expand("members,lastMessagePreview")
        .select("id,chatType,topic,lastUpdatedDateTime")
        .orderby("lastMessagePreview/createdDateTime desc")
        .top(pageSize)
        .get();

  return {
    chats: res.value as MSChat[],
    nextLink: (res["@odata.nextLink"] as string | undefined) ?? null,
  };
}

export async function getChatMessages(accessToken: string, chatId: string) {
  const client = getGraphClient(accessToken);
  const res = await client.api(`/me/chats/${chatId}/messages`).top(50).get();
  return res.value as MSMessage[];
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
  attachments?: ChatAttachment[]
) {
  const client = getGraphClient(accessToken);
  const payload: Record<string, unknown> = {
    body: { content, contentType: "html" },
  };
  if (attachments?.length) {
    payload.attachments = attachments;
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
