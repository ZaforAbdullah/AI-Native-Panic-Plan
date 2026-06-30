import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import { ThemeScript } from "@/components/ThemeScript";

const geistSans = Geist({ variable: "--geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://panic-plan.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "PanicPlan — AI Study Companion",
    template: "%s | PanicPlan",
  },
  description:
    "Upload your syllabus. Get a day-by-day study schedule with lessons, flashcards, and a 24/7 AI tutor. In two minutes.",
  keywords: ["study schedule", "exam planner", "AI tutor", "flashcards", "spaced repetition"],
  authors: [{ name: "PanicPlan" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "PanicPlan",
    title: "PanicPlan — From panic to a plan",
    description: "AI study companion. Lessons, flashcards, and a tutor that knows your syllabus.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PanicPlan — AI Study Companion",
    description: "Upload your syllabus. Get a plan that actually teaches you.",
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PanicPlan" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full`}
      style={{
        fontFamily: "var(--geist-sans), ui-sans-serif, sans-serif",
      } as React.CSSProperties}
    >
      <head>
        <style suppressHydrationWarning>{`
          :root {
            --font-sans: var(--geist-sans), ui-sans-serif, sans-serif;
            --font-mono: var(--geist-mono), ui-monospace, monospace;
            --font-serif: var(--newsreader), "Iowan Old Style", Georgia, serif;
          }
        `}</style>
      </head>
      <body className="antialiased min-h-full flex flex-col bg-background text-foreground">
        <ThemeScript />
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--paper-card)",
              border: "1px solid var(--rule)",
              color: "var(--ink)",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
