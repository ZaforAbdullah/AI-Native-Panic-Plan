"use client";

import { useState } from "react";
import type { Plan } from "@/lib/api";
import { cn } from "@/lib/utils";

// Topic mastery scores + study insights.
export function ProgressAnalytics({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);

  const topicMastery = plan.topic_records.map((topic) => {
    const sessions = plan.sessions.filter((s) => s.topic_id === topic.id);
    const completed = sessions.filter((s) => s.completed);
    const rated = completed.filter((s) => s.comprehension_rating != null);
    const avgRating = rated.length > 0
      ? rated.reduce((a, s) => a + (s.comprehension_rating ?? 0), 0) / rated.length
      : null;

    const completionRate = sessions.length > 0 ? completed.length / sessions.length : 0;
    const mastery = completed.length === 0
      ? Math.round((topic.confidence / 5) * 30)
      : avgRating !== null
      ? Math.round(completionRate * 35 + (avgRating / 5) * 65)
      : Math.round(completionRate * 60 + (topic.confidence / 5) * 20);

    const hoursStudied = completed.reduce((a, s) => a + s.duration_minutes / 60, 0);

    return { topic, mastery, avgRating, completionRate, hoursStudied, sessions, completed };
  });

  const totalHours = topicMastery.reduce((a, t) => a + t.hoursStudied, 0);
  const avgMastery = topicMastery.length > 0
    ? Math.round(topicMastery.reduce((a, t) => a + t.mastery, 0) / topicMastery.length)
    : 0;
  const best = topicMastery.sort((a, b) => b.mastery - a.mastery)[0];
  const weakest = topicMastery.sort((a, b) => a.mastery - b.mastery)[0];

  const fmtHours = (h: number) => h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 border border-border rounded-xl hover:bg-muted/60 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">📊</span>
          <div className="text-left">
            <p className="text-sm font-medium">Progress Analytics</p>
            <p className="text-xs text-muted-foreground/70">
              {avgMastery}% avg mastery · {fmtHours(totalHours)} studied
            </p>
          </div>
        </div>
        <span className="text-muted-foreground/60 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 bg-muted/50 border border-border rounded-xl p-4 space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Avg mastery", value: `${avgMastery}%` },
              { label: "Hours studied", value: fmtHours(totalHours) },
              { label: "Sessions done", value: `${plan.sessions.filter(s => s.completed).length}/${plan.sessions.length}` },
            ].map((s) => (
              <div key={s.label} className="text-center bg-muted/50 rounded-lg p-2.5">
                <div className="font-bold text-primary">{s.value}</div>
                <div className="text-muted-foreground/70 text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Topic mastery bars */}
          <div>
            <p className="text-xs text-muted-foreground/70 uppercase tracking-widest mb-3">Topic Mastery</p>
            <div className="space-y-3">
              {[...topicMastery].sort((a, b) => b.mastery - a.mastery).map(({ topic, mastery, avgRating, completed, sessions: ss }) => {
                const color = mastery >= 70 ? "bg-green-500" : mastery >= 40 ? "bg-amber-400" : "bg-red-400";
                return (
                  <div key={topic.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate max-w-[60%]">{topic.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/70 shrink-0">
                        {avgRating && <span>avg {avgRating.toFixed(1)}⭐</span>}
                        <span>{completed.length}/{ss.length}</span>
                        <span className={cn("font-bold", mastery >= 70 ? "text-green-400" : mastery >= 40 ? "text-amber-400" : "text-red-400")}>
                          {mastery}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${mastery}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights */}
          {topicMastery.length > 1 && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {best && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-green-400 text-xs font-medium mb-0.5">Strongest</p>
                  <p className="font-medium truncate">{best.topic.name}</p>
                  <p className="text-muted-foreground/70 text-xs">{best.mastery}% mastery</p>
                </div>
              )}
              {weakest && weakest.topic.id !== best?.topic.id && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-amber-400 text-xs font-medium mb-0.5">Focus on</p>
                  <p className="font-medium truncate">{weakest.topic.name}</p>
                  <p className="text-muted-foreground/70 text-xs">{weakest.mastery}% mastery</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
