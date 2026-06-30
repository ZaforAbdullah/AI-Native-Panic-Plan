"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getFlashcards, generateFlashcards } from "@/lib/api";
import type { Flashcard } from "@/lib/api";
import { cn } from "@/lib/utils";

// Flip cards with got-it / still-learning flow.
type CardResult = "known" | "learning";

export function FlashcardPanel({ lessonId, topicName }: { lessonId: number; topicName: string }) {
  const [mode, setMode] = useState<"idle" | "loading" | "studying" | "done">("idle");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, CardResult>>({});

  const start = async () => {
    setMode("loading");
    try {
      // Try cached first, generate if none
      let loaded = await getFlashcards(lessonId);
      if (!loaded.length) loaded = await generateFlashcards(lessonId);
      setCards(loaded);
      setIdx(0);
      setFlipped(false);
      setResults({});
      setMode(loaded.length > 0 ? "studying" : "idle");
      if (!loaded.length) toast.error("Couldn't generate flashcards — try again shortly.");
    } catch {
      setMode("idle");
      toast.error("Flashcard generation failed.");
    }
  };

  const handleResult = (result: CardResult) => {
    setResults((r) => ({ ...r, [idx]: result }));
    setFlipped(false);
    if (idx < cards.length - 1) {
      setTimeout(() => setIdx((i) => i + 1), 250);
    } else {
      setMode("done");
    }
  };

  if (mode === "idle") return (
    <button
      onClick={start}
      className="flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-primary transition py-0.5"
    >
      <span>🃏</span>
      <span>Generate flashcards for {topicName}</span>
    </button>
  );

  if (mode === "loading") return (
    <div className="flex items-center gap-2 text-sm text-primary animate-pulse py-0.5">
      <span>🃏</span><span>Generating flashcards…</span>
    </div>
  );

  if (mode === "done") {
    const known = Object.values(results).filter((r) => r === "known").length;
    const total = cards.length;
    return (
      <div className="bg-muted/50 border border-border rounded-xl p-4 text-center space-y-3">
        <div className="text-3xl">{known === total ? "🎉" : known >= total / 2 ? "💪" : "📖"}</div>
        <p className="font-semibold">
          {known}/{total} cards mastered
        </p>
        <p className="text-muted-foreground text-sm">
          {known === total
            ? "Perfect! You know this topic cold."
            : `${total - known} card${total - known !== 1 ? "s" : ""} to review more.`}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => { setIdx(0); setFlipped(false); setResults({}); setMode("studying"); }}
            className="text-xs px-3 py-1.5 bg-muted/50 border border-border rounded-lg hover:bg-white/10 transition"
          >
            Study again
          </button>
          <button
            onClick={() => setMode("idle")}
            className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground/60 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const card = cards[idx];
  if (!card) return null;

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/70">
        <span>🃏 Flashcards</span>
        <div className="flex items-center gap-2">
          <span>{idx + 1} / {cards.length}</span>
          <button onClick={() => setMode("idle")} className="hover:text-white/70 transition">×</button>
        </div>
      </div>
      <div className="flex gap-1">
        {cards.map((_, i) => (
          <div key={i} className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < idx
              ? results[i] === "known" ? "bg-green-500" : "bg-amber-400"
              : i === idx ? "bg-primary" : "bg-white/10"
          )} />
        ))}
      </div>

      {/* Flip card with CSS 3D transform */}
      <div className="[perspective:1200px] cursor-pointer" onClick={() => setFlipped((f) => !f)}>
        <div className={cn(
          "relative w-full min-h-[140px] transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]"
        )}>
          {/* Front */}
          <div className="absolute inset-0 [backface-visibility:hidden] bg-muted/50 border border-white/15 rounded-xl flex flex-col items-center justify-center p-5 text-center gap-2">
            <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">Question</p>
            <p className="text-sm font-medium leading-relaxed">{card.front}</p>
            {!flipped && <p className="text-xs text-white/25 mt-2">Tap to reveal answer</p>}
          </div>
          {/* Back */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-primary/10 border border-primary/30 rounded-xl flex flex-col items-center justify-center p-5 text-center gap-2">
            <p className="text-xs text-primary uppercase tracking-widest">Answer</p>
            <p className="text-sm leading-relaxed text-white/85">{card.back}</p>
          </div>
        </div>
      </div>

      {/* Action buttons — only after flip */}
      {flipped && (
        <div className="flex gap-2">
          <button
            onClick={() => handleResult("learning")}
            className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition"
          >
            😟 Still learning
          </button>
          <button
            onClick={() => handleResult("known")}
            className="flex-1 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-sm font-medium hover:bg-green-500/20 transition"
          >
            💪 Got it!
          </button>
        </div>
      )}
    </div>
  );
}
