import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Sans,
  Inter,
  Atkinson_Hyperlegible,
  JetBrains_Mono,
  Lora,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { ThemeApplier } from "@/components/layout/ThemeApplier";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const lora = Lora({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://teamsly.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Teamsly — A modern Microsoft Teams client",
    template: "%s · Teamsly",
  },
  description:
    "A modern, open-source Microsoft Teams client built for focus. Real-time chat, AI catch-up, voice rooms, and the keyboard-driven workflow Teams forgot.",
  applicationName: "Teamsly",
  keywords: [
    "Microsoft Teams client",
    "Teams alternative",
    "open source Teams",
    "Teams web client",
    "focus chat",
    "real-time team chat",
  ],
  authors: [{ name: "Teamsly" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Teamsly",
    title: "Teamsly — A modern Microsoft Teams client",
    description:
      "Real-time chat, AI catch-up digests, voice rooms, and a keyboard-first workflow. Sign in with your Microsoft account.",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Teamsly" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Teamsly — A modern Microsoft Teams client",
    description:
      "Real-time chat, AI catch-up digests, voice rooms, and a keyboard-first workflow.",
    images: ["/og.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: { canonical: SITE_URL },
  category: "productivity",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0F1A" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

// Concatenate all font-variable classes onto the html element so each CSS
// variable (--font-plex, --font-inter, etc.) is available regardless of which
// one ThemeApplier picks as the active font.
const fontVarClass = [
  ibmPlexSans.variable,
  inter.variable,
  atkinson.variable,
  jetbrains.variable,
  lora.variable,
].join(" ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVarClass}>
      <body className={fontVarClass}>
        <Providers>
          <ThemeApplier />
          {children}
        </Providers>
      </body>
    </html>
  );
}
