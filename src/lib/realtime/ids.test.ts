import { describe, expect, it } from "vitest";
import { decodeGraphId } from "./ids";

// Guards the root cause of the realtime outage: Next.js leaves route params
// percent-encoded, so every id must normalize to the raw Graph form whether
// it arrives encoded or raw.
describe("decodeGraphId", () => {
  it("decodes a percent-encoded chat id to the raw Graph form", () => {
    expect(
      decodeGraphId("19%3Aabc_def%40unq.gbl.spaces")
    ).toBe("19:abc_def@unq.gbl.spaces");
  });

  it("is a no-op for a raw chat id", () => {
    expect(decodeGraphId("19:abc_def@unq.gbl.spaces")).toBe("19:abc_def@unq.gbl.spaces");
  });

  it("handles channel ids (thread.tacv2) in both forms", () => {
    expect(decodeGraphId("19%3Axyz%40thread.tacv2")).toBe("19:xyz@thread.tacv2");
    expect(decodeGraphId("19:xyz@thread.tacv2")).toBe("19:xyz@thread.tacv2");
  });

  it("leaves GUID team ids untouched", () => {
    const guid = "4ea40cdd-dc2f-46c2-946b-bca515a6a672";
    expect(decodeGraphId(guid)).toBe(guid);
  });

  it("returns null for malformed percent escapes", () => {
    expect(decodeGraphId("19%ZZbad")).toBeNull();
  });

  it("decode-then-validate keeps the traversal guard: encoded slashes decode to /", () => {
    const CHAT_ID_SAFE = /^[A-Za-z0-9_@.:-]+$/;
    const decoded = decodeGraphId("..%2F..%2Fme%2Fmessages");
    expect(decoded).toBe("../../me/messages");
    expect(CHAT_ID_SAFE.test(decoded!)).toBe(false);
  });
});
