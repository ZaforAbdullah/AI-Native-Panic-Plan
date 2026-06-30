"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getPlanReviewCards } from "@/lib/api";
import type { Flashcard } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Loads all plan flashcards + presents them in a full-screen modal session.
export function QuickReviewButton({ planId }: { planId: number }) {
  const [mode, setMode] = useState<"idle" | "loading" | "reviewing" | "done">("idle");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, "known" | "learning">>({});

  const start = async () => {
    setMode("loading");
    try {
      const all = await getPlanReviewCards(planId);
      if (!all.length) {
        toast.info("No flashcards yet — open a lesson and generate flashcards first.");
        setMode("idle");
        return;
      }
      setCards(all);
      setIdx(0);
      setFlipped(false);
      setResults({});
      setMode("reviewing");
    } catch {
      toast.error("Couldn't load review cards.");
      setMode("idle");
    }
  };

  const handleResult = (r: "known" | "learning") => {
    setResults((prev) => ({ ...prev, [idx]: r }));
    setFlipped(false);
    if (idx < cards.length - 1) {
      setTimeout(() => setIdx((i) => i + 1), 200);
    } else {
      setMode("done");
    }
  };

  if (mode === "idle") return (
    <button
      onClick={start}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      ⚡ Quick Review
    </button>
  );

  if (mode === "loading") return (
    <button disabled className={buttonVariants({ variant: "outline", size: "sm" }) + " opacity-60"}>
      Loading…
    </button>
  );

  // Full-screen overlay modal for reviewing
  const card = cards[idx];
  const knownCount = Object.values(results).filter((r) => r === "known").length;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">⚡ Quick Review</h2>
            <p className="text-muted-foreground/70 text-xs">{cards.length} cards · {knownCount} known so far</p>
          </div>
          <button
            onClick={() => setMode("idle")}
            className="text-muted-foreground/70 hover:text-white transition text-2xl leading-none"
          >×</button>
        </div>

        {/* Progress bar */}
        {mode === "reviewing" && (
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
        )}

        {/* Card */}
        {mode === "reviewing" && card && (
          <>
            <div
              className="[perspective:1200px] cursor-pointer select-none"
              onClick={() => setFlipped((f) => !f)}
            >
              <div className={cn(
                "relative w-full min-h-[200px] transition-transform duration-500 [transform-style:preserve-3d]",
                flipped && "[transform:rotateY(180deg)]"
              )}>
                <div className="absolute inset-0 [backface-visibility:hidden] bg-muted/50 border border-white/15 rounded-2xl flex flex-col items-center justify-center p-6 text-center gap-3">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">Question</p>
                  <p className="text-base font-medium leading-relaxed">{card.front}</p>
                  {!flipped && <p className="text-xs text-white/25 mt-2">Tap to reveal →</p>}
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-primary/10 border border-primary/30 rounded-2xl flex flex-col items-center justify-center p-6 text-center gap-3">
                  <p className="text-xs text-primary uppercase tracking-widest">Answer</p>
                  <p className="text-sm leading-relaxed text-white/85">{card.back}</p>
                </div>
              </div>
            </div>

            {flipped && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleResult("learning")}
                  className="flex-1 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 font-medium hover:bg-amber-500/20 transition"
                >
                  😟 Still learning
                </button>
                <button
                  onClick={() => handleResult("known")}
                  className="flex-1 py-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 font-medium hover:bg-green-500/20 transition"
                >
                  💪 Got it!
                </button>
              </div>
            )}
          </>
        )}

        {/* Done */}
        {mode === "done" && (
          <div className="text-center space-y-4 py-6">
            <div className="text-5xl">{knownCount === cards.length ? "🏆" : knownCount >= cards.length / 2 ? "💪" : "📖"}</div>
            <h3 className="text-2xl font-bold">{knownCount}/{cards.length} mastered</h3>
            <p className="text-muted-foreground text-sm">
              {knownCount === cards.length
                ? "Perfect score — you're exam-ready on all covered topics!"
                : `${cards.length - knownCount} card${cards.length - knownCount !== 1 ? "s" : ""} to review more.`}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setIdx(0); setFlipped(false); setResults({}); setMode("reviewing"); }}
                className="px-4 py-2 bg-muted/50 border border-border rounded-xl text-sm hover:bg-white/10 transition"
              >
                Study again
              </button>
              <button
                onClick={() => setMode("idle")}
                className="px-4 py-2 bg-primary rounded-xl text-sm hover:bg-[#4a7aee] transition font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
