"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getPlan, completeSession, missSession } from "@/lib/api";
import type { Plan, StudySession } from "@/lib/api";
import { differenceInDays, parseISO, format } from "date-fns";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { RatingModal } from "./_components/RatingModal";
import { ReassessModal } from "./_components/ReassessModal";
import { ChatDrawer } from "./_components/ChatDrawer";
import { QuickReviewButton } from "./_components/QuickReviewButton";
import { ProgressAnalytics } from "./_components/ProgressAnalytics";
import { SessionCard } from "./_components/SessionCard";

export default function PlanPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const planId = Number(params.id);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingFor, setRatingFor] = useState<number | null>(null);
  const [showReassess, setShowReassess] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTopic, setChatTopic] = useState<string | undefined>();

  const load = useCallback(async () => {
    const p = await getPlan(planId);
    setPlan(p);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    load();
  }, [isAuthenticated, authLoading, router, load]);

  useEffect(() => {
    if (!plan) return;
    const daysLeft = differenceInDays(parseISO(plan.exam_date), new Date());
    if (daysLeft <= 3 && daysLeft >= 0) setShowReassess(true);
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const total = plan.sessions.length;
    const done = plan.sessions.filter((s) => s.completed).length;
    if (total > 0 && done === total) {
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
        confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
      });
      toast.success("🎉 Plan complete! You're ready for that exam.");
    }
  }, [plan]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading) return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground/60 animate-pulse">Loading your plan…</p>
    </main>
  );
  if (!plan) return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Plan not found.</p>
    </main>
  );

  const daysLeft = differenceInDays(parseISO(plan.exam_date), new Date());
  const totalSessions = plan.sessions.length;
  const completedSessions = plan.sessions.filter((s) => s.completed).length;
  const pct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySessions = plan.sessions.filter((s) => s.scheduled_date === todayStr && !s.completed && !s.is_missed);
  const sessionsByDate: Record<string, StudySession[]> = {};
  for (const s of plan.sessions) {
    if (!sessionsByDate[s.scheduled_date]) sessionsByDate[s.scheduled_date] = [];
    sessionsByDate[s.scheduled_date].push(s);
  }
  const upcomingDates = Object.keys(sessionsByDate).sort().filter((d) => d >= todayStr || sessionsByDate[d].some((s) => !s.completed));

  const handleComplete = async (sessionId: number, rating: number, note: string) => {
    await completeSession(sessionId, rating, note || undefined);
    await load();
    toast.success(rating >= 4 ? "Great session! 💪" : rating <= 2 ? "Review scheduled 📅" : "Session logged ✅");
  };

  const handleMiss = async (sessionId: number) => {
    await missSession(sessionId);
    await load();
    toast("We've rescheduled that across the next 3 days.", { icon: "😴" });
  };

  const openTutorFor = (topicName: string) => {
    setChatTopic(topicName);
    setChatOpen(true);
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8 pb-24">
      {/* Rating modal */}
      <RatingModal
        open={ratingFor !== null}
        onRate={(r, note) => { handleComplete(ratingFor!, r, note); setRatingFor(null); }}
        onClose={() => setRatingFor(null)}
      />

      {/* Reassess modal */}
      <ReassessModal
        open={showReassess}
        plan={plan}
        onDone={(p) => { setPlan(p); setShowReassess(false); toast.success("Schedule rebuilt!"); }}
        onClose={() => setShowReassess(false)}
      />

      {/* Chat drawer */}
      {chatOpen && (
        <ChatDrawer
          plan={plan}
          initialTopic={chatTopic}
          onClose={() => { setChatOpen(false); setChatTopic(undefined); }}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-muted-foreground"}>
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <QuickReviewButton planId={plan.id} />
            <Link href={`/plan/${plan.id}/share`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              📤 Share
            </Link>
          </div>
        </div>

        {/* Plan summary */}
        <div>
          <h1 className="text-3xl font-extrabold mb-1">{plan.subject}</h1>
          <div className="flex items-center gap-3 text-sm mb-4">
            <span className="text-muted-foreground">Exam: {plan.exam_date}</span>
            <span className={cn("font-medium tabular-nums",
              daysLeft <= 1 ? "text-red-400 animate-pulse" :
              daysLeft <= 3 ? "text-red-400" : daysLeft <= 7 ? "text-amber-400" : "text-foreground/60")}>
              {daysLeft > 1
                ? `${daysLeft} days left`
                : daysLeft === 1
                ? `Tomorrow`
                : daysLeft === 0
                ? "🚨 Exam is TODAY!"
                : "Past"}
            </span>
            {pct === 100 && (
              <span className="text-green-400 text-xs font-semibold">✓ Complete</span>
            )}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground/70 mb-1.5">
            <span>Overall progress</span>
            <span>{completedSessions} of {totalSessions} sessions done · {pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {/* Progress analytics — collapsible */}
        <ProgressAnalytics plan={plan} />

        {/* 3-day reassessment alert */}
        {daysLeft <= 3 && daysLeft >= 0 && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-xl">🔁</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-300 text-sm">Exam in {daysLeft} day{daysLeft !== 1 ? "s" : ""} — quick check-in?</p>
                <p className="text-muted-foreground text-xs">Tell us how you're feeling now so we can prioritise your final sessions.</p>
              </div>
              <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shrink-0" onClick={() => setShowReassess(true)}>
                Update confidence
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Today's sessions — highlighted */}
        {todaySessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-foreground">📅 Study Today</h2>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                {todaySessions.length} session{todaySessions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="space-y-3">
              {todaySessions.map((s, i) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  planId={plan.id}
                  defaultExpanded={i === 0}
                  showLesson={i === 0}
                  onComplete={(id) => setRatingFor(id)}
                  onMiss={handleMiss}
                  onAskTutor={openTutorFor}
                />
              ))}
            </div>
          </div>
        )}

        {/* All sessions by date */}
        <div>
          <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-widest mb-4">Full Schedule</h2>
          {upcomingDates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/60">
              <div className="text-4xl mb-2">🎉</div>
              <p>All sessions completed!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {upcomingDates.map((dateStr) => {
                const sessions = sessionsByDate[dateStr];
                const isToday = dateStr === todayStr;
                let label: string;
                try { label = format(parseISO(dateStr), "EEEE, MMMM d"); } catch { label = dateStr; }

                return (
                  <div key={dateStr}>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {isToday ? "Today" : label}
                      </p>
                      <div className="flex-1 h-px bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      {sessions.map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          planId={plan.id}
                          onComplete={(id) => setRatingFor(id)}
                          onMiss={handleMiss}
                          onAskTutor={openTutorFor}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating chat button with Cmd+K hint */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-1.5">
        <span className="text-[10px] text-white/25 pr-1 hidden sm:block">⌘K</span>
        <button
          onClick={() => { setChatTopic(undefined); setChatOpen(true); }}
          className="w-14 h-14 bg-primary rounded-full shadow-lg shadow-[#5b8eff]/30 flex items-center justify-center text-2xl hover:bg-[#4a7aee] hover:scale-110 active:scale-95 transition-all"
          title="AI Tutor (⌘K)"
        >
          💬
        </button>
      </div>
    </main>
  );
}
