import { describe, expect, it } from "vitest";
import { mergeThreadReplies, selectThreadParent } from "./threads";

// Guards the #164 fix: the thread panel must track the live parent message
// from the store (edits/reactions surface while open) and must surface
// server-fetched replies without dropping or duplicating optimistic ones.

function msg(id: string, over: Partial<MSMessage> = {}): MSMessage {
  return {
    id,
    createdDateTime: "2026-01-01T12:00:00Z",
    lastModifiedDateTime: "2026-01-01T12:00:00Z",
    body: { content: `msg ${id}`, contentType: "text" },
    from: { user: { id: "other-user", displayName: "Other" } },
    ...over,
  } as MSMessage;
}

describe("selectThreadParent", () => {
  it("returns the live message when the snapshot id is in the window", () => {
    const snapshot = msg("1");
    const live = msg("1", { body: { content: "edited", contentType: "text" } });
    expect(selectThreadParent([msg("0"), live, msg("2")], snapshot)).toBe(live);
  });

  it("falls back to the snapshot when the id left the window", () => {
    const snapshot = msg("gone");
    expect(selectThreadParent([msg("1"), msg("2")], snapshot)).toBe(snapshot);
  });

  it("returns null for a null snapshot", () => {
    expect(selectThreadParent([msg("1")], null)).toBeNull();
  });
});

describe("mergeThreadReplies", () => {
  it("appends optimistic local replies after server replies", () => {
    const merged = mergeThreadReplies([msg("r1")], [msg("temp-1", { __pending: true })]);
    expect(merged.map((m) => m.id)).toEqual(["r1", "temp-1"]);
  });

  it("dedupes a local reply once the server copy arrives, keeping the server copy", () => {
    const server = msg("r1", { body: { content: "server copy", contentType: "text" } });
    const local = msg("r1", { body: { content: "local copy", contentType: "text" } });
    const merged = mergeThreadReplies([server], [local]);
    expect(merged).toEqual([server]);
  });

  it("returns local replies alone when the parent has no server replies", () => {
    const local = msg("temp-1", { __pending: true });
    expect(mergeThreadReplies(undefined, [local])).toEqual([local]);
  });

  it("preserves server order ahead of local order", () => {
    const merged = mergeThreadReplies(
      [msg("r1"), msg("r2")],
      [msg("r2"), msg("temp-1"), msg("temp-2")]
    );
    expect(merged.map((m) => m.id)).toEqual(["r1", "r2", "temp-1", "temp-2"]);
  });
});
