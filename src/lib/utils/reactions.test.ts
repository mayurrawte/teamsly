import { describe, expect, it } from "vitest";
import { isReactionType, reactionsSignature } from "./reactions";

// Guards the reactions-invisibility bug: store merges and the memoized row
// key on lastModifiedDateTime, which Graph doesn't reliably bump for
// reaction-only changes — the signature is what makes them land.
describe("reactionsSignature", () => {
  const like = (id: string) => ({ reactionType: "like", user: { id, displayName: "x" } });
  const heart = (id: string) => ({ reactionType: "heart", user: { id, displayName: "x" } });

  it("is empty for missing or empty reactions", () => {
    expect(reactionsSignature(undefined)).toBe("");
    expect(reactionsSignature([])).toBe("");
  });

  it("is order-insensitive", () => {
    expect(reactionsSignature([like("a"), heart("b")])).toBe(
      reactionsSignature([heart("b"), like("a")])
    );
  });

  it("changes when a reaction is added", () => {
    expect(reactionsSignature([like("a")])).not.toBe(
      reactionsSignature([like("a"), like("b")])
    );
  });

  it("distinguishes the same type from different users and vice versa", () => {
    expect(reactionsSignature([like("a")])).not.toBe(reactionsSignature([like("b")]));
    expect(reactionsSignature([like("a")])).not.toBe(reactionsSignature([heart("a")]));
  });
});

describe("isReactionType", () => {
  it("accepts the six Teams reaction types and nothing else", () => {
    for (const t of ["like", "heart", "laugh", "surprised", "sad", "angry"]) {
      expect(isReactionType(t)).toBe(true);
    }
    expect(isReactionType("thumbsdown")).toBe(false);
    expect(isReactionType("")).toBe(false);
  });
});
