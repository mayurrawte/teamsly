import { describe, it, expect } from "vitest";
import { adminConsentUrl, isConsentError, MINIMAL_SCOPE } from "./consent";

describe("admin consent helper", () => {
  it("recognises the Entra 'needs admin approval' error shapes", () => {
    expect(isConsentError("AADSTS65001")).toBe(true);
    expect(isConsentError("access_denied")).toBe(true);
    expect(isConsentError("consent_required")).toBe(true);
    expect(isConsentError("OAuthCallbackError: AADSTS65001: The user or administrator has not consented")).toBe(true);
    expect(isConsentError("Configuration")).toBe(false);
    expect(isConsentError(null)).toBe(false);
  });

  it("builds a tenant-wide admin consent URL for the app", () => {
    const url = new URL(adminConsentUrl("abc-123", "https://teamsly.app/login")!);
    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/organizations/v2.0/adminconsent");
    expect(url.searchParams.get("client_id")).toBe("abc-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://teamsly.app/login");
    expect(url.searchParams.get("scope")).toContain("Chat.ReadWrite");
  });

  it("returns null without a client id (self-hosters who did not expose it)", () => {
    expect(adminConsentUrl(undefined, "https://x")).toBeNull();
    expect(adminConsentUrl("", "https://x")).toBeNull();
  });

  it("exposes the minimal sign-in scope set for incremental consent", () => {
    expect(MINIMAL_SCOPE.split(" ")).toContain("User.Read");
    expect(MINIMAL_SCOPE).not.toContain("Files.ReadWrite");
  });
});
