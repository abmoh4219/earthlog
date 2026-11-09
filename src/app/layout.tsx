import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { SearchDialog } from "@/components/Search";
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from "@/config";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";

// Headlines: Newsreader (OFL), an editorial serif with optical sizes, self-hosted at build time
// by next/font, so visitors never request Google Fonts.
const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website" },
  // The editions as a feed (ADR-0026), for feed readers.
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#07090f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable}`}
    >
      <body className="font-sans">
        {children}
        <SearchDialog />
      </body>
    </html>
  );
}
