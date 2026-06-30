"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { StudySession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SessionLesson } from "./SessionLesson";

const SESSION_BADGE: Record<string, string> = {
  learn:        "bg-primary/20 text-primary border-primary/30",
  review:       "bg-amber-500/20 text-amber-400 border-amber-500/30",
  practice:     "bg-purple-500/20 text-purple-400 border-purple-500/30",
  light_review: "bg-green-500/20 text-green-400 border-green-500/30",
};

export function SessionCard({ session, planId, defaultExpanded = false, showLesson = false, onComplete, onMiss, onAskTutor }: {
  session: StudySession;
  planId: number;
  defaultExpanded?: boolean;
  showLesson?: boolean;
  onComplete: (id: number) => void;
  onMiss: (id: number) => void;
  onAskTutor: (topicName: string) => void;
}) {
  const STORAGE_KEY = `panicplan_timer_${session.id}`;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [timerSec, setTimerSec] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const { startedAt, total } = JSON.parse(saved) as { startedAt: number; total: number };
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = total - elapsed;
    if (remaining <= 0) { localStorage.removeItem(STORAGE_KEY); return null; }
    return remaining;
  });

  useEffect(() => {
    if (timerSec !== null && timerSec > 0 && !timerRunning) setTimerRunning(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!timerRunning) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimerSec((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerRunning(false);
          localStorage.removeItem(STORAGE_KEY);
          toast("⏰ Time's up! Mark this session complete.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  const startTimer = () => {
    const total = session.duration_minutes * 60;
    setTimerSec(total);
    setTimerRunning(true);
    // Persist start time so refresh can reconstruct remaining seconds
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ startedAt: Date.now(), total }));
    toast(`▶ ${session.duration_minutes} min timer started`, { duration: 2000 });
  };

  const stopTimer = () => {
    setTimerRunning(false);
    setTimerSec(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const fmtTime = (sec: number) =>
    `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;

  const badgeClass = SESSION_BADGE[session.session_type] ?? "bg-white/10 text-foreground/60 border-border";

  // ── Missed state ──
  if (session.is_missed) return (
    <div className="flex items-center gap-2 text-sm text-amber-400/60 py-1 pl-2 border-l-2 border-amber-500/20">
      <span>😴</span>
      <span className="line-through">{session.topic_name ?? "Session"}</span>
      <span className="text-amber-400/40 text-xs">rescheduled across next 3 days</span>
    </div>
  );

  // ── Completed state ──
  if (session.completed) return (
    <div className="flex items-center justify-between py-2 pl-2 border-l-2 border-green-500/40">
      <div className="flex items-center gap-2">
        <span className="text-green-400">✓</span>
        <span className="text-sm text-foreground/60 line-through">{session.topic_name ?? "Session"}</span>
        <span className="text-xs text-muted-foreground/60">{session.duration_minutes}m</span>
        {session.comprehension_rating && (
          <span className="text-xs text-muted-foreground/40">{"⭐".repeat(session.comprehension_rating)}</span>
        )}
      </div>
      {session.user_note && (
        <span className="text-xs text-muted-foreground/60 truncate max-w-[160px]">"{session.user_note}"</span>
      )}
    </div>
  );

  // ── Pending state ──
  return (
    <Card className={cn(
      "border transition-all",
      expanded ? "border-primary/40 bg-primary/5" : "border-border bg-muted/50 hover:border-border"
    )}>
      {/* Session header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border shrink-0", badgeClass)}>
              {session.session_type.replace("_", " ")}
            </span>
            <span className="font-medium truncate">{session.topic_name ?? "Session"}</span>
            <span className="text-muted-foreground/60 text-sm shrink-0">{session.duration_minutes}m</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {timerRunning && timerSec !== null && (
              <span className="font-mono text-primary text-sm font-bold">{fmtTime(timerSec)}</span>
            )}
            <span className="text-muted-foreground/60 text-sm">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {session.notes && !expanded && (
          <p className="text-muted-foreground/70 text-xs mt-1.5 ml-0.5 line-clamp-1">{session.notes}</p>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* Coach tip */}
          {session.notes && (
            <div className="flex gap-2 text-sm text-foreground/60">
              <span className="shrink-0">📌</span>
              <span>{session.notes}</span>
            </div>
          )}

          {/* Lesson content — only visible in Study Today cards (showLesson=true).
              Full Schedule cards never show the lesson to prevent repetition. */}
          {showLesson && session.topic_id && (
            <div>
              <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-3">Study Material</p>
              <SessionLesson planId={planId} topicId={session.topic_id} topicName={session.topic_name ?? ""} autoLoad={showLesson} />
            </div>
          )}

          {/* Timer + actions */}
          <div className="pt-2 space-y-3 border-t border-border">
            {/* Timer bar */}
            {timerSec !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{timerRunning ? "Focus time" : "Paused"}</span>
                  <span className="font-mono font-bold text-primary">{fmtTime(timerSec)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{
                      width: `${((session.duration_minutes * 60 - timerSec) / (session.duration_minutes * 60)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {timerSec === null ? (
                <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={startTimer}>
                  ▶ Start {session.duration_minutes}m Timer
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-muted-foreground" onClick={stopTimer}>
                  ■ Stop Timer
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30"
                onClick={() => onComplete(session.id)}
              >
                ✓ Mark Done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground/60 hover:text-amber-400 text-xs"
                onClick={() => onMiss(session.id)}
              >
                Life happened
              </Button>
            </div>

            {/* Ask tutor */}
            <button
              onClick={() => onAskTutor(session.topic_name ?? "")}
              className="w-full text-xs text-primary/60 hover:text-primary transition py-1 flex items-center justify-center gap-1.5"
            >
              <span>💬</span>
              <span>Ask the AI tutor about {session.topic_name}</span>
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
