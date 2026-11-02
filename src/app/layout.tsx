import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SkylineSprite } from "@/components/mosaic/SkylineSprite";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: "Toronto Mosaic · DevFest Toronto 2026", template: "%s · Toronto Mosaic" },
  description: "Add your tile to a collaborative digital artwork of the Toronto skyline, created by 300 attendees at Google DevFest Toronto 2026.",
  openGraph: { title: "Toronto Mosaic", description: "Many ideas. One city. One future.", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#070923",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} dark`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SkylineSprite />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
