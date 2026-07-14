import { describe, expect, it } from "vitest";
import { firstKeywordMatch, parseKeywords } from "./keyword-match";

describe("parseKeywords", () => {
  it("splits, trims, lowercases, and drops blanks", () => {
    expect(parseKeywords("Prod Down, deploy ,  ,API")).toEqual(["prod down", "deploy", "api"]);
    expect(parseKeywords(null)).toEqual([]);
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("firstKeywordMatch", () => {
  it("returns the first matching keyword, case-insensitively", () => {
    expect(firstKeywordMatch("The DEPLOY failed on prod", ["prod down", "deploy"])).toBe("deploy");
    expect(firstKeywordMatch("prod down since 3am", ["prod down", "deploy"])).toBe("prod down");
  });

  it("returns null when nothing matches or the list is empty", () => {
    expect(firstKeywordMatch("all quiet", ["deploy"])).toBeNull();
    expect(firstKeywordMatch("anything", [])).toBeNull();
  });
});
