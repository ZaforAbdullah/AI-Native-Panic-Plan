"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateLesson, deleteLesson } from "@/lib/api";
import type { TopicLesson } from "@/lib/api";
import { RichText } from "./RichText";
import { FlashcardPanel } from "./FlashcardPanel";

// Inline lesson — expands inside the session card.
export function SessionLesson({ planId, topicId, topicName, autoLoad = false }: {
  planId: number; topicId: number; topicName: string;
  autoLoad?: boolean;
}) {
  const [lesson, setLesson] = useState<TopicLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [openAnswers, setOpenAnswers] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState(false);
  // Only shown when user explicitly requests it (or autoLoad is true)
  const [revealed, setRevealed] = useState(autoLoad);
  const loadedRef = useRef(false); // guard against StrictMode double-fire

  const load = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    setError(false);
    // POST returns cached lesson if it exists, or generates a new one.
    // Skipping the GET (which logged a noisy 404) — one round-trip, no console noise.
    generateLesson(planId, topicId)
      .then(setLesson)
      .catch(() => { setError(true); loadedRef.current = false; })
      .finally(() => setLoading(false));
  }, [planId, topicId]);

  // Only fetch when revealed
  useEffect(() => { if (revealed) load(); }, [revealed, load]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setLesson(null);
    try {
      await deleteLesson(planId, topicId);
      await generateLesson(planId, topicId).then(setLesson);
    } catch {
      setError(true);
    } finally {
      setRegenerating(false);
    }
  };

  const toggleAnswer = (i: number) => {
    const next = new Set(openAnswers);
    next.has(i) ? next.delete(i) : next.add(i);
    setOpenAnswers(next);
  };

  // Gate: if the user hasn't asked to see the lesson yet, show a single button
  if (!revealed) return (
    <button
      onClick={() => setRevealed(true)}
      className="flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-primary transition py-1"
    >
      <span>📚</span>
      <span>Study material for {topicName} →</span>
    </button>
  );

  if (loading || regenerating) return (
    <div className="py-4 space-y-3">
      <div className="flex items-center gap-2 text-primary text-xs">
        <span className="animate-spin inline-block">⚙</span>
        <span className="animate-pulse">
          {regenerating ? "Regenerating lesson with deeper content…" : `Building lesson for ${topicName}…`}
        </span>
      </div>
      <div className="space-y-2 animate-pulse">
        {[90, 75, 85, 60, 80, 50].map((w, i) => (
          <div key={i} className="h-2 bg-white/10 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="py-3 space-y-2">
      <p className="text-muted-foreground/70 text-sm">Couldn't generate lesson — the model may be busy or the topic is too short.</p>
      <button onClick={load} className="text-xs text-primary hover:underline">Try again →</button>
    </div>
  );

  if (!lesson) return null;

  return (
    <div className="space-y-6 pt-2">

      {/* Explanation */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Explanation</p>
        <RichText text={lesson.summary} className="text-foreground/80" />
      </div>

      {/* Key concepts — each with full detail */}
      {lesson.key_concepts?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Key Concepts</p>
          <div className="space-y-3">
            {lesson.key_concepts.map((kc, i) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <p className="font-semibold text-sm mb-1.5 text-foreground">{kc.concept}</p>
                <RichText text={kc.explanation} className="text-white/65" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Study tip + exam technique */}
      {lesson.study_tip && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Memory Aid & Exam Technique</p>
          <RichText text={lesson.study_tip} className="text-amber-200/80" />
        </div>
      )}

      {/* Common mistakes / misconceptions */}
      {(lesson.common_mistakes?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3">Common Mistakes</p>
          <div className="space-y-2">
            {(lesson.common_mistakes ?? []).map((m, i) => (
              <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                <RichText text={m} className="text-white/70" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worked examples */}
      {lesson.examples?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Worked Examples</p>
          <div className="space-y-3">
            {lesson.examples.map((ex, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <div className="p-4 bg-muted/50 border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground/70 mb-1.5">PROBLEM</p>
                  <RichText text={ex.question} className="text-white/85" />
                </div>
                {openAnswers.has(i) ? (
                  <div className="p-4 bg-green-500/5">
                    <p className="text-xs font-medium text-green-400 mb-2">SOLUTION</p>
                    <RichText text={ex.answer} className="text-foreground/80 font-mono text-xs" />
                    <button
                      onClick={() => toggleAnswer(i)}
                      className="mt-3 text-xs text-white/25 hover:text-muted-foreground transition"
                    >
                      Hide solution
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleAnswer(i)}
                    className="w-full py-2.5 text-xs text-primary/70 hover:text-primary hover:bg-primary/5 transition font-medium"
                  >
                    Show step-by-step solution →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flashcards — generated from lesson content */}
      {lesson && <FlashcardPanel lessonId={lesson.id} topicName={topicName} />}

      {/* Regenerate — clears cached lesson and generates fresh */}
      <div className="pt-1 border-t border-white/5 flex justify-end">
        <button
          onClick={handleRegenerate}
          className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition flex items-center gap-1"
        >
          <span>↺</span> Regenerate lesson
        </button>
      </div>

    </div>
  );
}
