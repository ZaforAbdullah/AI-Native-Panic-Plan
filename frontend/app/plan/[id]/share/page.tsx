"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPublicPlan } from "@/lib/api";
import type { PublicPlan } from "@/lib/api";
import { differenceInDays, parseISO } from "date-fns";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const CONFIDENCE_EMOJI = ["😰", "😟", "😐", "🙂", "💪"];

export default function SharePage() {
  const { isAuthenticated } = useAuth();
  const params = useParams();
  const planId = Number(params.id);
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [notFound, setNotFound] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(planId)) {
      setNotFound(true);
      return;
    }
    try {
      const p = await getPublicPlan(planId);
      setPlan(p);
    } catch {
      setNotFound(true);
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const handlePrint = () => {
    window.print();
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground/70">This plan link is invalid or no longer available.</p>
          <Link href="/" className="text-primary text-sm hover:underline">
            ← Back to PanicPlan
          </Link>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground/70 animate-pulse">Loading battle plan…</div>
      </main>
    );
  }

  const daysLeft = differenceInDays(parseISO(plan.exam_date), new Date());
  const totalSessions = plan.sessions.length;
  const completedSessions = plan.sessions.filter((s) => s.completed).length;
  const pct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur px-6 py-3 flex items-center justify-between">
        <Link href={`/plan/${plan.id}`} className="text-muted-foreground/70 hover:text-white text-sm transition">
          ← Back to plan
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            📋 Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            🖨️ Save as PDF
          </Button>
        </div>
      </div>

      {/* Card */}
      <div className="flex items-start justify-center px-4 py-12">
        <div
          ref={cardRef}
          className="w-full max-w-lg bg-gradient-to-br from-[#1a1d2e] to-[#0d0f1a] border border-border rounded-3xl overflow-hidden shadow-2xl print:shadow-none print:border-none"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5b8eff]/30 to-[#3b2fff]/20 px-8 py-8 border-b border-border">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-primary text-xs font-mono uppercase tracking-widest mb-1">Battle Plan</p>
                <h1 className="text-2xl font-extrabold leading-tight">{plan.subject}</h1>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={`text-2xl font-black ${
                    daysLeft <= 3 ? "text-red-400" : daysLeft <= 7 ? "text-amber-400" : "text-primary"
                  }`}
                >
                  {daysLeft > 0 ? `${daysLeft}` : "0"}
                </div>
                <div className="text-muted-foreground/70 text-xs">{daysLeft === 1 ? "day left" : "days left"}</div>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Progress</span>
                <span>{completedSessions}/{totalSessions} sessions · {pct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="px-8 py-6 border-b border-border">
            <p className="text-muted-foreground/70 text-xs uppercase tracking-widest mb-4">Topics & Confidence</p>
            <div className="space-y-2">
              {plan.topic_records.map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="text-sm text-foreground/80">{t.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{CONFIDENCE_EMOJI[t.confidence - 1]}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-4 rounded-sm ${
                            i < t.confidence ? "bg-primary" : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule preview */}
          <div className="px-8 py-6 border-b border-border">
            <p className="text-muted-foreground/70 text-xs uppercase tracking-widest mb-4">Schedule preview</p>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const sessionDates = [...new Set(plan.sessions.map((s) => s.scheduled_date))].sort().slice(0, 28);
                return sessionDates.map((d) => {
                  const daySessions = plan.sessions.filter((s) => s.scheduled_date === d);
                  const allDone = daySessions.every((s) => s.completed);
                  const anyMissed = daySessions.some((s) => s.is_missed);
                  return (
                    <div
                      key={d}
                      title={d}
                      className={`h-6 rounded-sm ${
                        allDone
                          ? "bg-green-500/70"
                          : anyMissed
                          ? "bg-amber-500/40"
                          : "bg-primary/40"
                      }`}
                    />
                  );
                });
              })()}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground/60">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-primary/40 mr-1" />Upcoming</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-green-500/70 mr-1" />Done</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-500/40 mr-1" />Missed</span>
            </div>
          </div>

          {/* Footer branding */}
          <div className="px-8 py-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Panic<span className="text-primary">Plan</span></p>
              <p className="text-muted-foreground/60 text-xs">panicplan.app</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground/70 text-xs">Exam: {plan.exam_date}</p>
              <p className="text-muted-foreground/40 text-xs">Generated by AI</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA below card — only shown to logged-out visitors */}
      {!isAuthenticated && (
        <div className="print:hidden text-center pb-16 space-y-3">
          <p className="text-muted-foreground/70 text-sm">Inspired? Build your own free plan in 2 minutes.</p>
          <Link href="/auth/register" className={buttonVariants()}>
            Start free at PanicPlan →
          </Link>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
