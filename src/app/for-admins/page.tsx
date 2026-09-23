import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, adminConsentUrl } from "@/lib/auth/consent";

export const metadata: Metadata = {
  title: "For IT admins — approving Teamsly",
  description:
    "What Teamsly accesses in Microsoft 365, what it stores (nothing), and how to grant tenant-wide consent in one click or run it under your own Azure app.",
};

const REPO = "https://github.com/mayurrawte/teamsly";

export default function ForAdminsPage() {
  const consent = adminConsentUrl(process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID, "https://teamsly.app/login");
  const groups: Array<[string, string]> = [
    ["sign-in", "Requested at first sign-in"],
    ["files", "Requested when a user opens Files"],
    ["presence", "Requested when a user enables presence"],
    ["meetings", "Requested when a user opens Meetings"],
  ];
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-indigo-500">For IT admins</p>
      <h1 className="mb-4 text-3xl font-bold">Approving Teamsly for your tenant</h1>
      <p className="mb-8 text-slate-600 dark:text-slate-400">
        A user in your organisation tried to sign in to Teamsly and Microsoft asked for admin approval. This page is
        what you are approving. Two minutes to read, one click to grant — or run it yourself under your own app.
      </p>

      <h2 className="mb-2 mt-10 text-xl font-semibold">What Teamsly is</h2>
      <p>
        An open-source (AGPL-3.0) web and desktop client for Microsoft Teams. It talks only to the official{" "}
        <a className="underline" href="https://learn.microsoft.com/graph/overview">Microsoft Graph API</a> with the
        user’s own delegated token — the same data the user already sees in Teams, nothing more. Source:{" "}
        <a className="underline" href={REPO}>{REPO}</a>.
      </p>

      <h2 className="mb-2 mt-10 text-xl font-semibold">What it stores</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>No messages, files, or directory data are stored by Teamsly. Every request is proxied live to Graph.</li>
        <li>The user’s OAuth tokens live in an encrypted, HTTP-only session cookie in their browser. No server-side token store.</li>
        <li>Optional AI catch-up (off by default) sends the selected thread text to OpenAI when the user asks for a summary.</li>
        <li>No analytics SDKs. One anonymous counter records how often sign-in fails on the consent wall.</li>
      </ul>
      <p className="mt-2 text-sm">
        Full text: <Link className="underline" href="/privacy">Privacy policy</Link>.
      </p>

      <h2 className="mb-2 mt-10 text-xl font-semibold">Permissions, and why</h2>
      <p className="mb-4">
        Teamsly asks incrementally: the first sign-in requests only what messaging needs; the rest is requested when a
        user opens that feature. Tenant-wide consent below covers all of them so users never see a prompt.
      </p>
      {groups.map(([when, label]) => (
        <div key={when} className="mb-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-500">{label}</h3>
          <table className="w-full text-sm">
            <tbody>
              {PERMISSIONS.filter((p) => p.when === when).map((p) => (
                <tr key={p.scope} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-1.5 pr-4 font-mono text-[13px] whitespace-nowrap">{p.scope}</td>
                  <td className="py-1.5 text-slate-600 dark:text-slate-400">{p.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-sm text-slate-600 dark:text-slate-400">
        All permissions are <em>delegated</em>: Teamsly can never act without a signed-in user and never sees more than
        that user could see in Teams. No application permissions are requested.
      </p>

      <h2 className="mb-2 mt-10 text-xl font-semibold">Option A — approve the hosted app (one click)</h2>
      {consent ? (
        <>
          <p className="mb-3">
            Sign in as a Global Administrator, Privileged Role Administrator, or Cloud Application Administrator, then:
          </p>
          <a
            href={consent}
            className="inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
          >
            Grant tenant-wide consent to Teamsly →
          </a>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            You can review or revoke it any time under Entra ID → Enterprise applications → Teamsly → Permissions.
          </p>
        </>
      ) : (
        <p>
          This Teamsly instance has not published its application id, so the consent link cannot be generated here.
          Ask the operator, or use option B.
        </p>
      )}

      <h2 className="mb-2 mt-10 text-xl font-semibold">Option B — run it under your own Azure app</h2>
      <p>
        Many organisations prefer this: register Teamsly as a first-party app in your tenant, grant the permissions
        above at registration time, and deploy the container. Users then never see a consent prompt and nothing leaves
        your infrastructure but Graph calls. The{" "}
        <a className="underline" href={`${REPO}/blob/main/SELF_HOSTING.md`}>self-hosting guide</a> walks through the
        registration, and <code>docker compose up</code> runs it.
      </p>

      <h2 className="mb-2 mt-10 text-xl font-semibold">Questions</h2>
      <p>
        Open an issue at <a className="underline" href={`${REPO}/issues`}>{REPO}/issues</a> or email{" "}
        <a className="underline" href="mailto:mayur@shipthis.co">mayur@shipthis.co</a>.
      </p>
    </main>
  );
}
