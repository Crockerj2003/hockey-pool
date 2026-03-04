import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ChangelogBanner from "@/components/ChangelogBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hockey Pool",
  description: "Pick NHL game winners with your friends",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="mx-auto min-h-screen max-w-lg pb-20 pt-4">
          <ChangelogBanner />
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
