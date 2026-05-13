interface MSTeam {
  id: string;
  displayName: string;
  description?: string;
}

interface MSChannel {
  id: string;
  displayName: string;
  description?: string;
  membershipType: "standard" | "private" | "shared";
}

interface MSMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  deletedDateTime?: string;
  subject?: string;
  body: {
    contentType: "text" | "html";
    content: string;
  };
  from?: {
    user?: {
      id: string;
      displayName: string;
    };
  };
  reactions?: Array<{
    reactionType: string;
    user: { id: string; displayName: string };
  }>;
  attachments?: Array<{
    id: string;
    contentType: string;
    name: string;
    contentUrl?: string;
    /** Adaptive Card JSON — may be a string or pre-parsed object from the Graph SDK */
    content?: string | Record<string, unknown> | null;
  }>;
  replies?: MSMessage[];
}

interface MSChat {
  id: string;
  chatType: "oneOnOne" | "group" | "meeting";
  topic?: string;
  // Only changes when the chat is renamed or members change — NOT on new messages.
  // For "most recent activity" use lastMessagePreview.createdDateTime instead.
  lastUpdatedDateTime: string;
  lastMessagePreview?: {
    createdDateTime?: string;
  };
  members?: MSChatMember[];
}

interface MSChatMember {
  id: string;
  displayName: string;
  userId?: string;
  email?: string;
}

interface MSChannelMember {
  id: string;
  displayName: string;
  email?: string;
  userId?: string;
  roles?: string[];
}

interface MSPresence {
  id: string;
  availability: "Available" | "Away" | "BeRightBack" | "Busy" | "DoNotDisturb" | "Offline" | "PresenceUnknown";
  activity: string;
}

interface MSUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
}
