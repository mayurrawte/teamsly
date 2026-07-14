import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export const metadata = {
  title: "Terms of Use — Teamsly",
  description: "Terms of use for Teamsly, the open-source Microsoft Teams client.",
};

export default function TermsPage() {
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
        <h1 className="mb-2 text-3xl font-black tracking-tight">Terms of Use</h1>
        <p className="mb-10 text-[13px] text-[#4a5568]">Last updated: May 17, 2026</p>

        <div className="flex flex-col gap-8 text-[14px] leading-relaxed text-[#8b9ab0]">

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">1. What is Teamsly</h2>
            <p>
              Teamsly is an open-source, third-party client interface for Microsoft Teams. It is
              not affiliated with, endorsed by, or sponsored by Microsoft Corporation. All
              Microsoft Teams data is accessed exclusively through the official Microsoft Graph API
              using your own Microsoft 365 account credentials.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">2. Acceptance of Terms</h2>
            <p>
              By accessing or using Teamsly — whether self-hosted or via the hosted service at
              teamsly.app — you agree to these terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">3. Self-Hosted Use</h2>
            <p>
              The Teamsly source code is released under the{" "}
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                GNU Affero General Public License v3.0 (AGPL-3.0)
              </a>
              . If you self-host Teamsly, you are solely responsible for your deployment,
              including security, compliance with your organisation&apos;s IT policies, and
              compliance with Microsoft&apos;s terms of service for the Graph API.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">4. Hosted Service</h2>
            <p className="mb-3">
              The hosted service at teamsly.app is currently provided free of charge — there is no
              paywall and no feature gating. By using the hosted service you agree to:
            </p>
            <ul className="flex flex-col gap-2 pl-4">
              {[
                "Use the service only for lawful purposes.",
                "Not attempt to reverse-engineer, abuse, or overload the service.",
                "Understand that resource-intensive features (such as AI summaries) may be subject to fair-use limits.",
                "Understand that the service may be modified, suspended, or discontinued with reasonable notice. If paid plans are ever introduced, existing functionality will not move behind a paywall without prior notice.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-[#818CF8]">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">5. Microsoft Graph API</h2>
            <p>
              Teamsly connects to Microsoft Graph API on your behalf using OAuth 2.0. By using
              Teamsly you also agree to{" "}
              <a
                href="https://www.microsoft.com/en-us/servicesagreement"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                Microsoft&apos;s Services Agreement
              </a>{" "}
              and{" "}
              <a
                href="https://learn.microsoft.com/en-us/graph/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                Microsoft Graph API terms
              </a>
              . Teamsly does not store, sell, or share your Microsoft data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to use Teamsly to:</p>
            <ul className="flex flex-col gap-2 pl-4">
              {[
                "Violate any applicable law or regulation.",
                "Send spam, malware, or unsolicited messages.",
                "Scrape, harvest, or collect data from Microsoft services beyond your own account.",
                "Attempt to gain unauthorised access to any system or network.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-[#818CF8]">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">7. Disclaimer of Warranties</h2>
            <p>
              Teamsly is provided &quot;as is&quot; without warranty of any kind, express or
              implied. We do not warrant that the service will be uninterrupted, error-free, or
              free of security vulnerabilities. Your use of Teamsly is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Teamsly and its contributors shall not be
              liable for any indirect, incidental, special, or consequential damages arising from
              your use of the service, including loss of data or business interruption.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">9. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of Teamsly after changes
              are posted constitutes acceptance of the updated terms. Material changes will be
              announced via the GitHub repository.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-bold text-white">10. Contact</h2>
            <p>
              Questions about these terms? Open an issue on{" "}
              <a
                href="https://github.com/mayurrawte/teamsly/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                GitHub
              </a>{" "}
              or email{" "}
              <a
                href="mailto:mayur@shipthis.co"
                className="text-[#818CF8] hover:text-white transition-colors"
              >
                mayur@shipthis.co
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
