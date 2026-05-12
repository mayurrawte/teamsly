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

export async function getChats(accessToken: string): Promise<MSChat[]> {
  const client = getGraphClient(accessToken);
  const all: MSChat[] = [];
  const MAX_CHATS = 200;

  let res = await client
    .api("/me/chats")
    .expand("members")
    .select("id,chatType,topic,lastUpdatedDateTime")
    .top(50)
    .get();

  while (true) {
    const page = res.value as MSChat[];
    for (const chat of page) {
      all.push(chat);
      if (all.length >= MAX_CHATS) return all;
    }

    const nextLink: string | undefined = res["@odata.nextLink"];
    if (!nextLink) break;

    res = await client.api(nextLink).get();
  }

  return all;
}

export async function getChatMessages(accessToken: string, chatId: string) {
  const client = getGraphClient(accessToken);
  const res = await client.api(`/me/chats/${chatId}/messages`).top(50).get();
  return res.value as MSMessage[];
}

export async function sendChatMessage(
  accessToken: string,
  chatId: string,
  content: string
) {
  const client = getGraphClient(accessToken);
  return client.api(`/me/chats/${chatId}/messages`).post({
    body: { content, contentType: "html" },
  });
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
