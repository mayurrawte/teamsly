import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    userId: string;
    /** Space-separated Graph scopes the user has consented to (incremental consent). */
    scopes: string;
  }
}
