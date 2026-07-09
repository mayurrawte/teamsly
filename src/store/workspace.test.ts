import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "./workspace";

// Guards the reconcile-race fixes: a stale poll must not drop just-sent
// messages, the SSE echo must not revert optimistic changes, deletes must not
// resurrect, and reaction-only changes must land despite an unchanged
// lastModifiedDateTime.

const CTX = "19%3Atest%40unq.gbl.spaces";

function msg(id: string, over: Partial<MSMessage> = {}): MSMessage {
  return {
    id,
    createdDateTime: new Date(2026, 0, 1, 12, 0, Number(id.replace(/\D/g, "") || 0)).toISOString(),
    lastModifiedDateTime: "2026-01-01T12:00:00Z",
    body: { content: `msg ${id}`, contentType: "text" },
    from: { user: { id: "other-user", displayName: "Other" } },
    ...over,
  } as MSMessage;
}

function messages() {
  return useWorkspaceStore.getState().messagesByContext[CTX] ?? [];
}

beforeEach(() => {
  useWorkspaceStore.setState({
    messagesByContext: {},
    expiredMessageIds: new Set<string>(),
  });
});

describe("setMessages reconcile", () => {
  it("preserves a pending optimistic message absent from the server array", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1")]);
    s.appendPendingMessage(CTX, msg("temp-1"));
    s.setMessages(CTX, [msg("1")]); // stale poll: no temp-1
    expect(messages().map((m) => m.id)).toContain("temp-1");
  });

  it("preserves a just-confirmed message inside its optimistic window when a stale poll lacks it", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1")]);
    s.appendPendingMessage(CTX, msg("temp-1"));
    // Send confirms: temp swapped for the server message (stamps the window).
    s.replaceMessage(CTX, "temp-1", msg("2"));
    // A poll whose GET started before the send resolves without message 2.
    s.setMessages(CTX, [msg("1")]);
    expect(messages().map((m) => m.id)).toContain("2");
  });

  it("drops a message once its optimistic window has expired and the server array lacks it", () => {
    const s = useWorkspaceStore.getState();
    useWorkspaceStore.setState({
      messagesByContext: {
        [CTX]: [msg("1"), msg("2", { __optimisticUntil: Date.now() - 1000 })],
      },
    });
    s.setMessages(CTX, [msg("1")]);
    expect(messages().map((m) => m.id)).not.toContain("2");
  });

  it("keeps the optimistic object over a stale server version inside the window", () => {
    const s = useWorkspaceStore.getState();
    const optimistic = msg("1", {
      __optimisticUntil: Date.now() + 10_000,
      reactions: [{ reactionType: "like", user: { id: "me", displayName: "Me" } }],
    });
    useWorkspaceStore.setState({ messagesByContext: { [CTX]: [optimistic] } });
    s.setMessages(CTX, [msg("1")]); // stale: no reaction yet
    expect(messages()[0].reactions).toHaveLength(1);
  });

  it("applies a reaction-only change even when lastModifiedDateTime is unchanged", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1")]);
    const withReaction = msg("1", {
      reactions: [{ reactionType: "heart", user: { id: "someone", displayName: "S" } }],
    });
    s.setMessages(CTX, [withReaction]);
    expect(messages()[0].reactions).toHaveLength(1);
  });

  it("preserves object identity when nothing changed (memo-friendly reconcile)", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1")]);
    const before = messages()[0];
    s.setMessages(CTX, [msg("1")]);
    expect(messages()[0]).toBe(before);
  });
});

describe("upsertMessage (realtime push path)", () => {
  it("does not overwrite a message inside its optimistic window", () => {
    const s = useWorkspaceStore.getState();
    const optimistic = msg("1", {
      __optimisticUntil: Date.now() + 10_000,
      body: { content: "edited", contentType: "html" },
      lastModifiedDateTime: "2026-01-01T12:00:05Z",
    });
    useWorkspaceStore.setState({ messagesByContext: { [CTX]: [optimistic] } });
    // SSE echo carrying Graph's stale pre-write version.
    s.upsertMessage(CTX, msg("1", { lastModifiedDateTime: "2026-01-01T12:00:01Z" }));
    expect(messages()[0].body.content).toBe("edited");
  });

  it("applies an update once the window has passed", () => {
    const s = useWorkspaceStore.getState();
    useWorkspaceStore.setState({
      messagesByContext: { [CTX]: [msg("1", { __optimisticUntil: Date.now() - 1 })] },
    });
    s.upsertMessage(CTX, msg("1", {
      lastModifiedDateTime: "2026-01-01T12:00:09Z",
      body: { content: "server version", contentType: "text" },
    }));
    expect(messages()[0].body.content).toBe("server version");
  });

  it("applies a reaction-only change with an unchanged lastModifiedDateTime", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1")]);
    s.upsertMessage(CTX, msg("1", {
      reactions: [{ reactionType: "like", user: { id: "someone", displayName: "S" } }],
    }));
    expect(messages()[0].reactions).toHaveLength(1);
  });

  it("inserts a genuinely new message", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1")]);
    s.upsertMessage(CTX, msg("2"));
    expect(messages().map((m) => m.id)).toEqual(["1", "2"]);
  });
});

describe("delete tombstones", () => {
  it("a deleted message cannot be resurrected by a poll or an SSE echo", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1"), msg("2")]);
    s.deleteMessage(CTX, "2");
    // Poll racing Graph's softDelete replication still returns it.
    s.setMessages(CTX, [msg("1"), msg("2")]);
    expect(messages().map((m) => m.id)).toEqual(["1"]);
    s.upsertMessage(CTX, msg("2"));
    expect(messages().map((m) => m.id)).toEqual(["1"]);
  });

  it("undo (restoreMessage) lifts the tombstone", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1"), msg("2")]);
    const snapshot = s.deleteMessage(CTX, "2");
    expect(snapshot).not.toBeNull();
    s.restoreMessage(CTX, snapshot!.message, snapshot!.index);
    expect(messages().map((m) => m.id)).toEqual(["1", "2"]);
    // Polls keep it after the undo.
    s.setMessages(CTX, [msg("1"), msg("2")]);
    expect(messages().map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("expired disappearing messages stay gone across polls", () => {
    const s = useWorkspaceStore.getState();
    s.setMessages(CTX, [msg("1"), msg("2")]);
    s.expireMessage(CTX, "2");
    s.setMessages(CTX, [msg("1"), msg("2")]);
    expect(messages().map((m) => m.id)).toEqual(["1"]);
  });
});
