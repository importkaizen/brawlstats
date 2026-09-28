import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

function metadataBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // Invalid URL would crash every page during metadata resolution.
    }
  }
  return new URL("http://localhost:3000");
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101113" },
    { media: "(prefers-color-scheme: light)", color: "#101113" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "MyreBrawl — Track Your Brawl Stars Ranked Grind",
  description:
    "Auto-tracked rating graphs, brawler win rates, and map breakdowns for your Brawl Stars ranked matches. Connect your tag and we'll do the rest.",
  metadataBase: metadataBaseUrl(),
  openGraph: {
    title: "MyreBrawl",
    description: "Track your Brawl Stars ranked grind automatically.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyreBrawl",
    description: "Track your Brawl Stars ranked grind automatically.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} antialiased`}>{children}</body>
    </html>
  );
}
