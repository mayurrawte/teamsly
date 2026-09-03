/**
 * Helpers for the "Need admin approval" wall.
 *
 * Most Microsoft 365 tenants disable user consent for third-party apps, so the
 * first sign-in from a work account fails with AADSTS65001 / access_denied.
 * The fix is a tenant-wide admin consent, which an admin grants by opening one
 * URL — we surface that URL instead of a bare error code.
 */

/** Scopes a first sign-in truly needs; the rest can be requested when a feature is opened. */
export const MINIMAL_SCOPE = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "User.ReadBasic.All",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "ChannelMessage.Read.All",
  "ChannelMessage.Send",
  "Chat.ReadWrite",
].join(" ");

/** Every delegated permission the app can use (what an admin consents to). */
export const FULL_SCOPE = [
  MINIMAL_SCOPE,
  "Presence.Read.All",
  "Presence.ReadWrite",
  "Files.Read.All",
  "Files.ReadWrite",
  "Calendars.Read",
].join(" ");

const CONSENT_ERROR = /AADSTS65001|AADSTS90094|access_denied|consent_required|admin approval/i;

export function isConsentError(code: string | null | undefined): boolean {
  return !!code && CONSENT_ERROR.test(code);
}

/**
 * Tenant-wide admin consent URL for this app. Returns null when the public
 * client id is not configured (self-hosters can set NEXT_PUBLIC_AZURE_AD_CLIENT_ID).
 */
export function adminConsentUrl(clientId: string | undefined, redirectUri: string): string | null {
  if (!clientId) return null;
  const u = new URL("https://login.microsoftonline.com/organizations/v2.0/adminconsent");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", FULL_SCOPE);
  return u.toString();
}
