import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { appendFileSync } from "node:fs";

const DESKTOP = process.env.DESKTOP_MODE === "1";

const SCOPE = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "ChannelMessage.Read.All",
  "ChannelMessage.Send",
  "Chat.ReadWrite",
  "Presence.Read.All",
  "Presence.ReadWrite",
  "Files.Read.All",
  "Files.ReadWrite",
  "Calendars.Read",
  "User.ReadBasic.All",
].join(" ");

async function refreshAccessToken(refreshToken: string) {
  const tenant = process.env.AZURE_AD_TENANT_ID ?? "common";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPE,
  });
  if (!DESKTOP) {
    params.set("client_secret", process.env.AZURE_AD_CLIENT_SECRET!);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? "refresh failed");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
  };
}

// Concurrent requests can enter the jwt callback at the same time right after the
// access token expires; each would call refreshAccessToken with the SAME
// (single-use) refresh token, and Entra invalidates it on first use — so all but
// one get invalid_grant and force a spurious re-login. Coalesce concurrent
// refreshes for a given refresh token into one in-flight request per instance.
const inflightRefreshes = new Map<string, ReturnType<typeof refreshAccessToken>>();
function refreshAccessTokenDeduped(refreshToken: string) {
  const existing = inflightRefreshes.get(refreshToken);
  if (existing) return existing;
  const p = refreshAccessToken(refreshToken).finally(() => {
    inflightRefreshes.delete(refreshToken);
  });
  inflightRefreshes.set(refreshToken, p);
  return p;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The bundled desktop server runs on a loopback host under NODE_ENV=production
  // with no VERCEL/AUTH_URL, so NextAuth would otherwise default trustHost to
  // false and reject every /api/auth request (UntrustedHost). Trust the host
  // only in desktop mode — on web this key is absent, so Vercel's own
  // env-based detection (VERCEL=1 → true) is preserved unchanged.
  ...(DESKTOP ? { trustHost: true } : {}),
  ...(DESKTOP
    ? {
        // Desktop serves over plain http://localhost. In production NextAuth can
        // emit Secure/__Secure- cookies, which the browser refuses to store over
        // HTTP — dropping the PKCE/state cookie and breaking the OAuth callback.
        // Force non-secure cookies for the loopback server.
        useSecureCookies: false,
        // Land auth errors on the app's own /login page so the code is visible.
        pages: { signIn: "/login", error: "/login" },
        // Mirror auth errors to a file the user can open (no devtools/terminal).
        logger: {
          error(error: Error) {
            try {
              const f = process.env.TEAMSLY_LOG_FILE;
              if (f) {
                appendFileSync(
                  f,
                  `[${new Date().toISOString()}] ${error?.name ?? "Error"}: ${error?.message ?? ""}\n${error?.stack ?? ""}\n\n`
                );
              }
            } catch {
              /* best-effort logging */
            }
          },
        },
      }
    : {}),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      ...(DESKTOP ? {} : { clientSecret: process.env.AZURE_AD_CLIENT_SECRET! }),
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID ?? "common"}/v2.0`,
      authorization: { params: { scope: SCOPE } },
      // Desktop is a public client: no secret; prove possession via PKCE.
      ...(DESKTOP
        ? {
            client: { token_endpoint_auth_method: "none" as const },
            checks: ["pkce", "state"] as ("pkce" | "state")[],
          }
        : {}),
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          error: undefined,
        };
      }

      const expiresAt = typeof token.expiresAt === "number" ? token.expiresAt : 0;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && now < expiresAt - 60) {
        return token;
      }

      if (!token.refreshToken || typeof token.refreshToken !== "string") {
        return { ...token, error: "RefreshAccessTokenError" };
      }

      try {
        const refreshed = await refreshAccessTokenDeduped(token.refreshToken);
        return {
          ...token,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
          error: undefined,
        };
      } catch (err) {
        console.error("[auth] refresh failed:", err);
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.userId = (token.sub as string) ?? "";
      if (token.error) {
        (session as unknown as { error?: string }).error = token.error as string;
      }
      return session;
    },
  },
});
