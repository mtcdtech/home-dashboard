import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Home Dashboard",
  description: "A premium, customizable homepage dashboard",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

/*
 * Theme color is a single, non-media-qualified value on purpose.
 *
 * Next.js renders `themeColor: [{media,color}, ...]` as multiple
 * <meta name="theme-color" media="..."> tags, and iOS Safari prefers
 * the matching media-qualified tag over an unqualified one. The
 * dashboard runtime updates a single <meta name="theme-color"> on every
 * tab/theme change, so any media-qualified tags from this export would
 * out-rank the runtime tag and freeze the iOS status bar at the static
 * color. Keeping a single static fallback here means the runtime tag is
 * the only one Safari can match, and the dashboard's per-tab tint is
 * what actually paints the Dynamic Island gutter in PWA mode.
 *
 * Note: in Safari tab mode (non-standalone), the OS status bar lives
 * outside the web view, so the best achievable result is theme-color +
 * body tint — the theme image cannot reach the OS status strip.
 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable}`}>
        <Providers>
          <div className="bg-gradient" />
          {children}
          <div style={{ position: 'fixed', bottom: '8px', right: '12px', fontSize: '0.7rem', fontWeight: 600, opacity: 0.3, zIndex: 99999, pointerEvents: 'none' }}>
            v{require('../../package.json').version}
          </div>
        </Providers>
      </body>
    </html>
  );
}
