interface MSTeam {
  id: string;
  displayName: string;
  description?: string;
}

interface MSCalendarEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl?: string } | null;
  organizer?: { emailAddress?: { name?: string; address?: string } };
  attendees?: Array<{
    emailAddress?: { name?: string; address?: string };
    status?: { response?: string; time?: string };
    type?: "required" | "optional" | "resource";
  }>;
  webLink?: string;
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
    /** Graph may return `null` for attachments that aren't user-named (e.g. messageReference) */
    name?: string | null;
    contentUrl?: string | null;
    /** Adaptive Card JSON / messageReference JSON — may be a string or pre-parsed object from the Graph SDK */
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

interface MSDriveItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime: string;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  parentReference?: { path?: string; name?: string };
  remoteItem?: {
    id: string;
    name?: string;
    webUrl?: string;
    file?: { mimeType?: string };
    folder?: { childCount?: number };
    parentReference?: { path?: string; name?: string };
    lastModifiedDateTime?: string;
    size?: number;
  };
}

interface MSPresence {
  id: string;
  availability: "Available" | "Away" | "BeRightBack" | "Busy" | "DoNotDisturb" | "Offline" | "PresenceUnknown";
  activity: string;
  statusMessage?: {
    message?: { content: string; contentType?: "text" | "html" } | null;
    expiryDateTime?: { dateTime: string; timeZone: string } | null;
  } | null;
}

interface MSUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
}
