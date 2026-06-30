"use client";

import { useState } from "react";
import { toast } from "sonner";
import { reassessPlan } from "@/lib/api";
import type { Plan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ReassessModal({ open, plan, onDone, onClose }: {
  open: boolean; plan: Plan; onDone: (p: Plan) => void; onClose: () => void;
}) {
  const EMOJIS = ["😰", "😟", "😐", "🙂", "💪"];
  const [upd, setUpd] = useState<Record<number, number>>(
    Object.fromEntries(plan.topic_records.map((t) => [t.id, t.confidence]))
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const updated = await reassessPlan(plan.id, Object.entries(upd).map(([id, c]) => ({
        topic_id: Number(id), new_confidence: c,
      })));
      onDone(updated);
    } catch {
      toast.error("Couldn't rebuild your schedule — try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>How are you feeling now?</DialogTitle>
          <DialogDescription>We'll rebuild your remaining sessions around your current confidence.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {plan.topic_records.map((t) => (
            <div key={t.id}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">{t.name}</span>
                <span>{EMOJIS[(upd[t.id] ?? t.confidence) - 1]}</span>
              </div>
              <div className="flex gap-1.5">
                {EMOJIS.map((e, ci) => (
                  <button key={ci} onClick={() => setUpd({ ...upd, [t.id]: ci + 1 })}
                    className={cn("flex-1 py-2 rounded-lg text-lg border transition",
                      (upd[t.id] ?? t.confidence) === ci + 1 ? "bg-primary/20 border-primary" : "bg-muted/50 border-border hover:bg-white/10")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={busy} onClick={submit}>
            {busy ? "Rebuilding… this can take a minute" : "Rebuild My Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
