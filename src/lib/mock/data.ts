export const mockTeams: MSTeam[] = [
  { id: "team-1", displayName: "Engineering", description: "Product engineering team" },
  { id: "team-2", displayName: "Design", description: "Design & UX team" },
  { id: "team-3", displayName: "Marketing", description: "Growth & marketing" },
];

export const mockChannels: Record<string, MSChannel[]> = {
  "team-1": [
    { id: "ch-general", displayName: "general", membershipType: "standard" },
    { id: "ch-backend", displayName: "backend", membershipType: "standard" },
    { id: "ch-frontend", displayName: "frontend", membershipType: "standard" },
    { id: "ch-devops", displayName: "devops", membershipType: "standard" },
    { id: "ch-incidents", displayName: "incidents", membershipType: "private" },
    { id: "ch-releases", displayName: "releases", membershipType: "standard" },
  ],
  "team-2": [
    { id: "ch-design-general", displayName: "general", membershipType: "standard" },
    { id: "ch-figma", displayName: "figma-reviews", membershipType: "standard" },
    { id: "ch-brand", displayName: "brand", membershipType: "private" },
  ],
  "team-3": [
    { id: "ch-marketing-general", displayName: "general", membershipType: "standard" },
    { id: "ch-campaigns", displayName: "campaigns", membershipType: "standard" },
  ],
};

export const mockMessages: Record<string, MSMessage[]> = {
  "ch-general": [
    msg("msg-1", "Sarah Chen", "2026-05-08T08:02:00Z", "Good morning team! Daily standup in 10 minutes 👋"),
    msg("msg-2", "Alex Kumar", "2026-05-08T08:05:00Z", "Morning! I'll be 2 mins late, just finishing a PR review."),
    msg("msg-3", "Jordan Lee", "2026-05-08T08:06:00Z", "No worries, I'll start the call. Link is in the calendar."),
    msg("msg-4", "Sarah Chen", "2026-05-08T09:15:00Z", "Standup notes are up in Notion. Key blockers: auth flow needs backend review before we can ship the onboarding."),
    reactedMsg(
      "msg-5",
      "Priya Nair",
      "2026-05-08T09:22:00Z",
      "I can take a look at auth this afternoon. @Alex can you share the PR link?",
      [
        ["like", "u-sarah", "Sarah Chen"],
        ["heart", "you", "You"],
      ]
    ),
    msg("msg-6", "Alex Kumar", "2026-05-08T09:24:00Z", "Sure, PR #412 — https://github.com/example/app/pull/412. Main thing to check is the token refresh logic."),
    msg("msg-7", "Jordan Lee", "2026-05-08T10:00:00Z", "Deploy to staging is done. QA team please take a look when you get a chance."),
    threadedMsg(
      "msg-8",
      "Ravi Shah",
      "2026-05-08T10:14:00Z",
      "Tested on staging. Login flow works great. Found one small issue with the redirect after password reset — filed it as #447.",
      [
        ["msg-8-r1", "Alex Kumar", "2026-05-08T10:16:00Z", "Thanks for filing it. I can reproduce locally too."],
        ["msg-8-r2", "Sarah Chen", "2026-05-08T10:17:00Z", "Let's keep it in staging until that fix lands."],
      ]
    ),
    msg("msg-9", "Sarah Chen", "2026-05-08T10:18:00Z", "Nice catch Ravi. Alex can you grab that one too or should I assign it to someone else?"),
    msg("msg-10", "Alex Kumar", "2026-05-08T10:20:00Z", "I'll grab it, shouldn't take long."),
    msg("msg-11", "Priya Nair", "2026-05-08T11:45:00Z", "PR #412 reviewed ✅ Left a few minor comments but nothing blocking. LGTM overall."),
    msg("msg-12", "Alex Kumar", "2026-05-08T11:50:00Z", "Thanks Priya! Will address the comments and merge after lunch."),
    msg("msg-13", "Jordan Lee", "2026-05-08T14:02:00Z", "Merged and deployed to staging. Onboarding flow is live for testing."),
    msg("msg-14", "Sarah Chen", "2026-05-08T14:15:00Z", "Amazing! I'll test it now and loop in design for a final check before we push to prod."),
  ],
  "ch-frontend": [
    msg("fx-1", "Priya Nair", "2026-05-08T09:00:00Z", "Heads up: upgraded to React 19 on the feature branch. Tests all pass but wanted to flag it."),
    msg("fx-2", "Jordan Lee", "2026-05-08T09:03:00Z", "Nice. Any breaking changes we need to handle?"),
    msg("fx-3", "Priya Nair", "2026-05-08T09:05:00Z", "One thing — the old context API pattern we used in the auth provider needed updating. Fixed it already."),
    msg("fx-4", "Alex Kumar", "2026-05-08T09:10:00Z", "Good to know. I'll rebase my branch on top of yours to avoid conflicts."),
    msg("fx-5", "Jordan Lee", "2026-05-08T11:00:00Z", "Anyone noticed the sidebar flicker on route change? Reproduced it on Chrome 124."),
    msg("fx-6", "Priya Nair", "2026-05-08T11:08:00Z", "Yeah saw that. It's a layout shift from the async data fetch. We should add a loading skeleton."),
    msg("fx-7", "Alex Kumar", "2026-05-08T11:12:00Z", "I can do that. Give me an hour."),
  ],
  "ch-backend": [
    msg("bk-1", "Ravi Shah", "2026-05-08T08:30:00Z", "Database migration ran clean on staging. Ready for prod whenever we are."),
    msg("bk-2", "Sarah Chen", "2026-05-08T08:35:00Z", "Perfect. Let's schedule prod migration for tonight at 11pm when traffic is lowest."),
    msg("bk-3", "Ravi Shah", "2026-05-08T08:37:00Z", "Sounds good. I'll be on call. Should take under 5 minutes."),
    msg("bk-4", "Jordan Lee", "2026-05-08T08:40:00Z", "I'll monitor dashboards during the window. Will post in #incidents if anything looks off."),
  ],
  "ch-design-general": [
    msg("ds-1", "Maya Torres", "2026-05-08T09:30:00Z", "New onboarding screens are ready for review in Figma. Link: figma.com/file/xyz"),
    msg("ds-2", "Chris Wang", "2026-05-08T09:45:00Z", "These look great Maya! The step indicator at the top is much cleaner than before."),
    msg("ds-3", "Maya Torres", "2026-05-08T09:50:00Z", "Thanks! Took a few iterations. Main change was reducing the number of steps from 7 to 4."),
    msg("ds-4", "Chris Wang", "2026-05-08T10:00:00Z", "Engineering will be happy about that 😄 Less to build."),
  ],
};

export const mockChats: MSChat[] = [
  {
    id: "chat-1",
    chatType: "oneOnOne",
    lastUpdatedDateTime: "2026-05-08T11:00:00Z",
    members: [{ id: "u-sarah", displayName: "Sarah Chen", userId: "u-sarah" }],
  },
  {
    id: "chat-2",
    chatType: "oneOnOne",
    lastUpdatedDateTime: "2026-05-08T10:00:00Z",
    members: [{ id: "u-ravi", displayName: "Ravi Shah", userId: "u-ravi" }],
  },
  {
    id: "chat-3",
    chatType: "group",
    topic: "Launch prep crew",
    lastUpdatedDateTime: "2026-05-08T09:00:00Z",
    members: [
      { id: "u-alex", displayName: "Alex Kumar", userId: "u-alex" },
      { id: "u-maya", displayName: "Maya Torres", userId: "u-maya" },
      { id: "u-jordan", displayName: "Jordan Lee", userId: "u-jordan" },
    ],
  },
];

export const mockPresence: Record<string, MSPresence["availability"]> = {
  "u-sarah": "Available",
  "u-ravi": "Busy",
  "u-alex": "Away",
  "u-maya": "Available",
  "u-jordan": "DoNotDisturb",
  you: "Available",
};

export const mockChatMessages: Record<string, MSMessage[]> = {
  "chat-1": [
    msg("dm-1", "Sarah Chen", "2026-05-08T10:00:00Z", "Hey! Can you check the staging deploy when you get a sec?"),
    msg("dm-2", "You", "2026-05-08T10:05:00Z", "On it now. Looks good from my end."),
    msg("dm-3", "Sarah Chen", "2026-05-08T10:06:00Z", "Amazing, thanks! 🙌"),
  ],
  "chat-2": [
    msg("dm-4", "Ravi Shah", "2026-05-08T09:00:00Z", "Migration script is ready. Want to do a dry run?"),
    msg("dm-5", "You", "2026-05-08T09:10:00Z", "Yes let's do it. I'll join the call."),
  ],
  "chat-3": [
    msg("dm-6", "Alex Kumar", "2026-05-08T08:00:00Z", "Launch checklist updated. 3 items left."),
    msg("dm-7", "Maya Torres", "2026-05-08T08:05:00Z", "I'll knock out the design sign-off today."),
    msg("dm-8", "Jordan Lee", "2026-05-08T08:10:00Z", "And I'll handle the infra checklist. We're on track 🚀"),
  ],
};

function msg(id: string, displayName: string, createdDateTime: string, content: string): MSMessage {
  return {
    id,
    createdDateTime,
    body: { contentType: "text", content },
    from: { user: { id: `user-${displayName.replace(" ", "-").toLowerCase()}`, displayName } },
    reactions: [],
  };
}

function threadedMsg(
  id: string,
  displayName: string,
  createdDateTime: string,
  content: string,
  replies: Array<[string, string, string, string]>
): MSMessage {
  return {
    ...msg(id, displayName, createdDateTime, content),
    replies: replies.map(([replyId, replyAuthor, replyTime, replyContent]) =>
      msg(replyId, replyAuthor, replyTime, replyContent)
    ),
  };
}

function reactedMsg(
  id: string,
  displayName: string,
  createdDateTime: string,
  content: string,
  reactions: Array<[string, string, string]>
): MSMessage {
  return {
    ...msg(id, displayName, createdDateTime, content),
    reactions: reactions.map(([reactionType, userId, userName]) => ({
      reactionType,
      user: { id: userId, displayName: userName },
    })),
  };
}
