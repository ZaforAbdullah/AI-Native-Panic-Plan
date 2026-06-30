"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { listPlans, deletePlan, getUserStats } from "@/lib/api";
import type { PlanSummary, UserStats } from "@/lib/api";
import { differenceInDays, parseISO } from "date-fns";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    Promise.all([listPlans(), getUserStats()])
      .then(([p, s]) => { setPlans(p); setStats(s); })
      .catch(() => toast.error("Failed to load your plans or stats."))
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, router]);

  const handleDelete = async (id: number) => {
    try {
      await deletePlan(id);
      setPlans(plans.filter((p) => p.id !== id));
      toast.success("Plan deleted.");
    } catch {
      toast.error("Couldn't delete the plan.");
    }
  };

  const fmtMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min > 0 ? `${min}m` : ""}`.trim() : `${min}m`;
  };

  // Exams sorted by urgency
  const sorted = [...plans].sort((a, b) =>
    differenceInDays(parseISO(a.exam_date), new Date()) -
    differenceInDays(parseISO(b.exam_date), new Date())
  );

  const nextExam = sorted.find((p) => differenceInDays(parseISO(p.exam_date), new Date()) >= 0);

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this plan?"
        description="All sessions, lessons, and chat history for this exam will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget !== null && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Panic<span className="text-primary">Plan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              📄 Upload PDF
            </Link>
            <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <span className="text-base">⚙</span> Settings
            </Link>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground/70">
              Log out
            </Button>
          </div>
        </div>

        {/* ── What to do right now ── */}
        {!loading && nextExam && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">Next up</h2>
            <Link href={`/plan/${nextExam.id}`}>
              <Card className="bg-gradient-to-br from-[#5b8eff]/20 to-[#3b2fff]/10 border-primary/40 hover:border-primary/70 transition group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-xl font-bold group-hover:text-primary transition">
                          {nextExam.subject}
                        </h3>
                        {(() => {
                          const d = differenceInDays(parseISO(nextExam.exam_date), new Date());
                          return d <= 3 ? (
                            <Badge variant="destructive" className="text-xs">
                              {d === 0 ? "Today!" : `${d}d left`}
                            </Badge>
                          ) : d <= 7 ? (
                            <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">{d} days left</Badge>
                          ) : (
                            <span className="text-muted-foreground/70 text-sm">{d} days left</span>
                          );
                        })()}
                      </div>
                      <p className="text-muted-foreground text-sm mb-4">Exam: {nextExam.exam_date}</p>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground/70">
                          <span>Sessions done</span>
                          <span>{nextExam.completed_sessions}/{nextExam.total_sessions}</span>
                        </div>
                        <Progress
                          value={nextExam.total_sessions > 0
                            ? Math.round((nextExam.completed_sessions / nextExam.total_sessions) * 100)
                            : 0}
                          className="h-2"
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-3xl mb-1">📚</div>
                      <p className="text-primary text-xs font-medium">Open plan →</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* ── Stats strip ── */}
        {stats && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">Your progress</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  value: stats.streak_days > 0 ? `🔥 ${stats.streak_days}` : "—",
                  label: "day streak",
                  highlight: stats.streak_days > 0,
                },
                { value: stats.sessions_this_week, label: "sessions this week", highlight: false },
                { value: stats.total_completed_sessions, label: "total done", highlight: false },
                { value: fmtMinutes(stats.total_minutes_studied), label: "studied", highlight: false },
              ].map((s) => (
                <Card key={s.label} className={cn("border", s.highlight ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/50 border-border")}>
                  <CardContent className="p-4 text-center">
                    <div className={cn("text-2xl font-bold", s.highlight ? "text-amber-400" : "text-primary")}>
                      {s.value}
                    </div>
                    <div className="text-muted-foreground/70 text-xs mt-0.5">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {stats.studied_today && (
              <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                <span>✅</span>
                <span>You studied today — keep the streak going!</span>
              </div>
            )}
          </div>
        )}

        {/* ── All exams ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">All exams</h2>
            <div className="flex gap-2">
              <Link href="/upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}>
                Upload PDF
              </Link>
              <Link href="/onboarding" className={cn(buttonVariants({ size: "sm" }), "text-xs")}>
                + Add exam
              </Link>
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />)}
            </div>
          )}

          {!loading && plans.length === 0 && (
            <div className="text-center py-16 space-y-5">
              <div className="text-5xl">😰</div>
              <div>
                <h3 className="text-lg font-semibold mb-1">No exams yet</h3>
                <p className="text-muted-foreground/70 text-sm max-w-xs mx-auto">
                  Add your first exam and get a personalised study plan in 2 minutes.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/upload" className={buttonVariants({ variant: "outline" })}>
                  📄 Upload syllabus or notes
                </Link>
                <Link href="/onboarding" className={buttonVariants()}>
                  Add topics manually
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sorted.map((plan) => {
              const daysLeft = differenceInDays(parseISO(plan.exam_date), new Date());
              const pct = plan.total_sessions > 0
                ? Math.round((plan.completed_sessions / plan.total_sessions) * 100)
                : 0;
              const isNext = plan.id === nextExam?.id;

              return (
                <Link key={plan.id} href={`/plan/${plan.id}`} className="block">
                  <Card className={cn(
                    "border hover:border-primary/50 transition group",
                    isNext ? "border-primary/20 bg-primary/5" : "border-border bg-muted/50"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <h3 className="font-semibold group-hover:text-primary transition truncate">
                              {plan.subject}
                            </h3>
                            {daysLeft <= 3 && daysLeft >= 0 && (
                              <Badge variant="destructive" className="text-xs shrink-0">
                                {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                              </Badge>
                            )}
                            {daysLeft > 3 && daysLeft <= 7 && (
                              <Badge className="text-xs shrink-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                {daysLeft}d
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground/70 text-xs mb-3">Exam: {plan.exam_date}</p>
                          <div className="flex items-center gap-3">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-muted-foreground/60 text-xs shrink-0">
                              {plan.completed_sessions}/{plan.total_sessions}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.preventDefault(); setDeleteTarget(plan.id); }}
                          className="text-muted-foreground/40 hover:text-destructive shrink-0"
                        >
                          ×
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
