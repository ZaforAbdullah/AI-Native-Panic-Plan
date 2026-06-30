"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function RatingModal({ open, onRate, onClose }: {
  open: boolean;
  onRate: (rating: number, note: string) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const emojis = ["😰", "😟", "😐", "🙂", "💪"];
  const labels = ["Lost", "Shaky", "OK", "Solid", "Nailed it"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>How well did you understand it?</DialogTitle>
          <DialogDescription>Be honest — it helps us schedule your next review.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2 py-1">
          {emojis.map((e, i) => (
            <button
              key={i}
              onClick={() => setSel(i + 1)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
                sel === i + 1
                  ? "bg-primary/30 border-primary scale-105"
                  : "bg-muted/50 border-border hover:border-primary/40"
              )}
            >
              <span className="text-xl">{e}</span>
              <span className="text-xs text-muted-foreground">{labels[i]}</span>
            </button>
          ))}
        </div>
        {sel !== null && sel <= 2 && (
          <p className="text-xs text-amber-400 text-center -mt-1">
            📅 We'll add a review session in 2 days
          </p>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: jot a quick note about what you covered or what was unclear"
          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary resize-none"
          rows={2}
        />
        <Button
          className="w-full"
          disabled={sel === null}
          onClick={() => { onRate(sel!, note); setSel(null); setNote(""); }}
        >
          Log session
        </Button>
      </DialogContent>
    </Dialog>
  );
}
