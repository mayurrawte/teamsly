import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export const metadata = {
  title: "Privacy Policy — Teamsly",
  description: "Privacy policy for Teamsly, the open-source Microsoft Teams client.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Nav */}
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={24} className="text-white" />
          <span className="text-[14px] font-semibold tracking-tight">Teamsly</span>
        </Link>
        <Link href="/" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">
          ← Back
        </Link>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <h1 className="mb-2 text-3xl font-black tracking-tight">Privacy Policy</h1>
        <p className="mb-10 text-[13px] text-[#4a5568]">Last updated: May 17, 2026</p>

        <div className="flex flex-col gap-8 text-[14px] leading-relaxed text-[#8b9ab0]">

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">Overview</h2>
            <p>
              Teamsly is designed with privacy at its core. Your Microsoft Teams messages,
              files, and contacts are fetched live from the official Microsoft Graph API and
              displayed directly in your browser. <strong className="text-white">Teamsly
              does not store, log, or transmit your Teams data to any server we control.</strong>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">1. Data We Do Not Collect</h2>
            <p className="mb-3">Teamsly never collects or stores:</p>
            <ul className="flex flex-col gap-2 pl-4">
              {[
                "Your Teams messages, chats, or channel content.",
                "Your contacts, presence status, or profile information.",
                "Your files or attachments accessed via Microsoft Graph.",
                "Your Microsoft 365 credentials or access tokens (beyond the session cookie described below).",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-[#818CF8]">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">2. Authentication & Session Data</h2>
            <p>
              Teamsly uses{" "}
              <a
                href="https://authjs.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                Auth.js (NextAuth)
              </a>{" "}
              with Microsoft Entra ID (Azure AD) as the identity provider. When you sign in:
            </p>
            <ul className="mt-3 flex flex-col gap-2 pl-4">
              {[
                "An encrypted session cookie is stored in your browser to keep you signed in.",
                "Your Microsoft OAuth access token is held server-side in memory for the duration of your session only.",
                "No session data is written to a database — sessions exist only in memory and the browser cookie.",
                "Signing out clears the session cookie immediately.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-[#818CF8]">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">3. Microsoft Graph API</h2>
            <p>
              All Teams data flows directly between your browser and Microsoft&apos;s servers via
              the official Graph API. Teamsly&apos;s API routes act as a thin proxy — they forward
              your request to Microsoft, receive the response, and return it to your browser.
              Nothing is cached or persisted. Microsoft&apos;s own privacy policy governs how they
              handle your data:{" "}
              <a
                href="https://privacy.microsoft.com/en-us/privacystatement"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                microsoft.com/privacy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">4. Analytics & Tracking</h2>
            <p>
              Teamsly does not use any third-party analytics, tracking pixels, or advertising
              scripts. There are no cookies beyond the authentication session cookie described
              above.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">5. AI Features</h2>
            <p>
              If AI message summaries are enabled (via <code className="rounded bg-[#1a1d21] px-1 py-0.5 text-[#818CF8]">NEXT_PUBLIC_AI_ENABLED</code>),
              the last 30 messages from the active chat are sent to the Anthropic API to generate
              a summary. This data is subject to{" "}
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                Anthropic&apos;s privacy policy
              </a>
              . Anthropic does not use API inputs to train models by default. AI summaries are
              opt-in and disabled by default.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">6. GIF Search</h2>
            <p>
              GIF search is powered by the Tenor API (Google). Search queries are sent to
              Tenor&apos;s servers and are subject to{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                Google&apos;s privacy policy
              </a>
              . No personally identifiable information is sent with GIF search requests.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">7. Self-Hosted Deployments</h2>
            <p>
              If you self-host Teamsly, you control all infrastructure and are solely responsible
              for data handling within your deployment. The privacy commitments in this policy
              apply to the hosted service at teamsly.app only.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">8. Data Retention</h2>
            <p>
              For the hosted service: session cookies expire after sign-out or browser close.
              We do not retain any Teams data after your session ends. Subscription billing
              records (name, email, payment reference) are retained by our payment processor
              (Stripe/Polar) per their own retention policies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">9. Your Rights</h2>
            <p className="mb-3">
              Since we store virtually no personal data, most data rights (access, deletion,
              portability) are exercised directly with Microsoft via your Microsoft account
              settings. For any data we do hold (billing email for the hosted service):
            </p>
            <ul className="flex flex-col gap-2 pl-4">
              {[
                "You may request deletion by emailing mayur@shipthis.co.",
                "We will respond within 30 days.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-[#818CF8]">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">10. Changes to This Policy</h2>
            <p>
              We may update this policy as the product evolves. Changes will be announced via the{" "}
              <a
                href="https://github.com/mayurrawte/teamsly"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                GitHub repository
              </a>
              . Continued use of Teamsly after changes are posted constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">11. Contact</h2>
            <p>
              Privacy questions or concerns? Email{" "}
              <a
                href="mailto:mayur@shipthis.co"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                mayur@shipthis.co
              </a>{" "}
              or open an issue on{" "}
              <a
                href="https://github.com/mayurrawte/teamsly/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                GitHub
              </a>
              .
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-6" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-[12px] text-[#3d4a5c]">
          <span>Teamsly · AGPL-3.0</span>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <a href="https://github.com/mayurrawte/teamsly" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
