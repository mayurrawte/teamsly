import { describe, expect, it } from "vitest";
import { isCelebrationMessage } from "./celebrate";

describe("isCelebrationMessage", () => {
  it("accepts pure celebration emoji", () => {
    expect(isCelebrationMessage("🎉")).toBe(true);
    expect(isCelebrationMessage("🎉🎉🎉")).toBe(true);
    expect(isCelebrationMessage("🎊 🥳")).toBe(true);
    expect(isCelebrationMessage("🥳🚀")).toBe(true); // other emoji allowed alongside a trigger
  });
  it("rejects text, mixed content, missing trigger, and empties", () => {
    expect(isCelebrationMessage("party at 🎉 9")).toBe(false);
    expect(isCelebrationMessage("congrats!")).toBe(false);
    expect(isCelebrationMessage("🚀🚀")).toBe(false); // emoji but no celebration trigger
    expect(isCelebrationMessage("")).toBe(false);
    expect(isCelebrationMessage("<p>🎉</p>")).toBe(true); // html-wrapped still counts
    expect(isCelebrationMessage("🎉".repeat(40))).toBe(false); // > 32 chars after strip
  });
});
