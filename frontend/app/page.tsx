"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "Drop your notes",
    desc: "Syllabus, lecture pack, past exam — anything you'd revise from. AI reads it and extracts every topic.",
  },
  {
    n: "02",
    title: "Get a schedule + lessons",
    desc: "A day-by-day plan with a written lesson for every topic. Spaced repetition built in.",
  },
  {
    n: "03",
    title: "Study with your tutor",
    desc: "Ask anything. Your AI tutor knows your syllabus, your confidence levels, and your exam date.",
  },
];

const FEATURES = [
  {
    title: "Lessons, not just sessions",
    desc: "Every session opens to a full lesson — explanation, key concepts, worked examples, common mistakes.",
  },
  {
    title: "Flashcards in one tap",
    desc: "AI generates flip-card decks from your lessons. Know it / still learning — that's the whole flow.",
  },
  {
    title: "Life happened, we adjusted",
    desc: "Miss a session? We spread it quietly across the next three days. No red warnings, no guilt.",
  },
  {
    title: "Pre-exam check-in",
    desc: "Three days out, a quick confidence re-rating rebuilds your final sessions around what you actually need.",
  },
];

const FAQS = [
  {
    q: "How long does it take to set up?",
    a: "Under two minutes. Drop a PDF, confirm the extracted topics, set your daily hours. Done.",
  },
  {
    q: "What if I don't have a PDF?",
    a: "Type topics in manually and rate your confidence on each. Takes about 90 seconds.",
  },
  {
    q: "Does the schedule actually adapt?",
    a: "Yes. Rate each session 1–5. Score low and a review session appears automatically. Miss a session and the time is redistributed.",
  },
  {
    q: "What AI is it using?",
    a: "Google Gemini for schedule generation, lesson writing, flashcards, and the tutor chat. Your notes never leave the session.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="logo text-lg">
            <em>panic</em><span className="dot">·</span>plan
          </span>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-5 text-sm text-muted-foreground mr-2">
              <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </div>
            <ThemeToggle />
            {isAuthenticated ? (
              <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                My plans
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
                  Log in
                </Link>
                <Link href="/auth/register" className={buttonVariants({ size: "sm" })}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero — one door in ── */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="font-serif font-normal text-5xl sm:text-7xl leading-[1.02] tracking-tight mb-6 text-foreground animate-settle">
          Drop your syllabus.
          <br />
          <em className="text-muted-foreground">Get a plan that teaches you.</em>
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-settle-2">
          PanicPlan reads your notes, writes a lesson for every topic, and gives you a tutor
          that knows exactly what's on your exam. Two minutes from PDF to first session.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-settle-3">
          <Link
            href="/upload"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-teal text-white hover:bg-teal-deep rounded-xl px-8 py-5 text-base font-medium shadow-md shadow-teal/20"
            )}
            style={{ background: "var(--teal)", color: "#fff" }}
          >
            📄 Drop a syllabus or notes
          </Link>
          <Link
            href={isAuthenticated ? "/onboarding" : "/auth/register"}
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "text-muted-foreground text-sm"
            )}
          >
            No PDF? Enter topics by hand →
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="border-t border-border pt-14 mb-14">
          <p className="meta mb-3">How it works</p>
          <h2 className="font-serif font-normal text-4xl tracking-tight">Three steps.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-mono text-xs text-muted-foreground mb-3 tracking-widest">{s.n}</div>
              <h3 className="font-semibold text-base mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="meta mb-3">What you get</p>
          <h2 className="font-serif font-normal text-4xl tracking-tight mb-14">
            A tutor, a planner, and a coach —{" "}
            <em className="text-muted-foreground">in one.</em>
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-semibold text-[15px] mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <p className="meta mb-3">Questions</p>
          <h2 className="font-serif font-normal text-4xl tracking-tight mb-12">FAQ</h2>
          <div className="space-y-8">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b border-border pb-8 last:border-0">
                <h3 className="font-semibold text-[15px] mb-2">{f.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h2 className="font-serif font-normal text-4xl tracking-tight mb-4">
            Stop dreading. <em className="text-muted-foreground">Start planning.</em>
          </h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Your future self will thank you for opening this tonight.
          </p>
          <Link
            href="/upload"
            className={cn(buttonVariants({ size: "lg" }), "rounded-xl px-8")}
            style={{ background: "var(--teal)", color: "#fff" }}
          >
            Upload your notes →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span className="logo text-sm"><em>panic</em><span className="dot">·</span>plan</span>
          <div className="flex gap-5">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <Link href="/auth/login" className="hover:text-foreground transition-colors">Login</Link>
          </div>
          <span>© {new Date().getFullYear()} PanicPlan</span>
        </div>
      </footer>
    </div>
  );
}
