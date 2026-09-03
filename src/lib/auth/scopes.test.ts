import { describe, it, expect } from "vitest";
import { parseScopes, hasScopes, unionScopes, missingScopesFor, FEATURE_SCOPES } from "./scopes";
import { MINIMAL_SCOPE, FULL_SCOPE } from "./consent";

describe("scope helpers", () => {
  it("parses a space-separated scope string, ignoring blanks and Graph URL prefixes", () => {
    expect(parseScopes(" User.Read  https://graph.microsoft.com/Chat.ReadWrite ")).toEqual(["User.Read", "Chat.ReadWrite"]);
    expect(parseScopes(undefined)).toEqual([]);
  });
  it("hasScopes is true only when every needed scope was granted", () => {
    expect(hasScopes(MINIMAL_SCOPE, ["User.Read", "Chat.ReadWrite"])).toBe(true);
    expect(hasScopes(MINIMAL_SCOPE, ["Files.Read.All"])).toBe(false);
    expect(hasScopes(FULL_SCOPE, FEATURE_SCOPES.files)).toBe(true);
  });
  it("unionScopes merges without duplicates and keeps order", () => {
    expect(unionScopes("a b", "b c")).toBe("a b c");
  });
  it("missingScopesFor lists what a feature still needs", () => {
    expect(missingScopesFor(MINIMAL_SCOPE, "files")).toEqual(["Files.Read.All", "Files.ReadWrite"]);
    expect(missingScopesFor(FULL_SCOPE, "files")).toEqual([]);
    expect(missingScopesFor(MINIMAL_SCOPE, "calendar")).toEqual(["Calendars.Read"]);
    expect(missingScopesFor(MINIMAL_SCOPE, "presence")).toContain("Presence.Read.All");
  });
});
