"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { savePlanFromSessions, createPlan } from "@/lib/api";
import type { TopicInput, PrebuiltSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";

const CONFIDENCE_EMOJIS = ["😰", "😟", "😐", "🙂", "💪"];
const CONFIDENCE_LABELS = ["Not started", "Shaky", "Okay", "Pretty solid", "Solid"];

function parseSessionsFromText(text: string): PrebuiltSession[] {
  let content = text.trim();
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) content = fenceMatch[1].trim();
  const start = content.indexOf("{");
  if (start !== -1) content = content.slice(start);
  const data = JSON.parse(content);
  return (data.sessions ?? []) as PrebuiltSession[];
}

export default function OnboardingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | "streaming">(1);
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topics, setTopics] = useState<TopicInput[]>([{ name: "", confidence: 3 }]);
  const [dailyHours, setDailyHours] = useState(3);
  const [error, setError] = useState("");
  const [streamText, setStreamText] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/auth/register");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) return null;

  const addTopic = () => setTopics([...topics, { name: "", confidence: 3 }]);
  const removeTopic = (i: number) => {
    if (topics.length === 1) return;
    setTopics(topics.filter((_, idx) => idx !== i));
  };
  const updateTopic = (i: number, field: keyof TopicInput, value: string | number) =>
    setTopics(topics.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  const handleGenerate = async () => {
    const validTopics = topics
      .filter((t) => t.name.trim())
      .map((t) => ({ ...t, name: t.name.trim() }));
    if (!subject.trim() || !examDate || validTopics.length === 0) {
      setError("Please fill in all fields before generating.");
      return;
    }
    setError("");
    setStep("streaming");
    setStreamText("");
    setStatusMsg("AI is building your schedule…");

    try {
      // ── Vercel AI SDK streaming ─────────────────────────────────────────────
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          examDate,
          topics: validTopics,
          dailyHours,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamText(fullText);

        // Error token emitted by the backend when AI throws during streaming
        if (fullText.includes("__ERROR__:quota_exceeded")) {
          throw new Error("AI quota exceeded. Please wait a few minutes and try again.");
        }
        if (fullText.includes("__ERROR__:invalid_api_key")) {
          throw new Error("Gemini API key is not valid. Check GEMINI_API_KEY in backend/.env");
        }
        if (fullText.includes("__ERROR__:")) {
          throw new Error("Schedule generation failed. Try again in a moment.");
        }
      }

      // ── Parse + save ────────────────────────────────────────────────────────
      setStatusMsg("Saving your plan…");

      let plan;
      try {
        // Happy path: stream completed with valid JSON
        const sessions = parseSessionsFromText(fullText);
        plan = await savePlanFromSessions({
          subject,
          exam_date: examDate,
          topics: validTopics,
          daily_hours: dailyHours,
          sessions,
        });
      } catch {
        // JSON was truncated (model hit token limit) — fall back to backend AI
        setStatusMsg("Finalising your schedule…");
        plan = await createPlan({
          subject,
          exam_date: examDate,
          topics: validTopics,
          daily_hours: dailyHours,
        });
      }

      router.push(`/plan/${plan.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setStep(3);
      setError(msg);
      toast.error(msg);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  // ── Streaming view ─────────────────────────────────────────────────────────
  if (step === "streaming") {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="max-w-xl w-full space-y-6 text-center">
          <div className="space-y-2">
            <div className="text-4xl animate-bounce">✨</div>
            <h2 className="text-2xl font-bold">{statusMsg}</h2>
            <p className="text-muted-foreground text-sm">
              Building a day-by-day schedule for <span className="text-primary font-medium">{subject}</span>
            </p>
          </div>

          <Card className="text-left bg-card border-border">
            <CardContent className="p-4">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">
                {streamText || "Waiting for AI response…"}
                <span className="animate-pulse">▍</span>
              </pre>
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-xs">
            Streaming live from Gemini.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <Link href="/" className="text-2xl font-bold">
            Panic<span className="text-primary">Plan</span>
          </Link>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : s < step
                    ? "bg-green-500 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? "✓" : s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-0.5 ${s < step ? "bg-green-500" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm mb-6">
            {error}
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">When is your exam?</h2>
              <p className="text-muted-foreground text-sm">Tell us what you're studying for.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject name</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Organic Chemistry, Algorithms, Macro Econ"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="examDate">Exam date</Label>
              <Input
                id="examDate"
                type="date"
                min={today}
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="bg-input border-border"
                style={{ colorScheme: "dark" }}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (!subject.trim() || !examDate) {
                  setError("Fill in both fields");
                  return;
                }
                setError("");
                setStep(2);
              }}
            >
              Next →
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">How confident are you?</h2>
              <p className="text-muted-foreground text-sm">
                Add each topic and rate your current confidence.
              </p>
            </div>

            <div className="space-y-4">
              {topics.map((topic, i) => (
                <Card key={i} className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={topic.name}
                        onChange={(e) => updateTopic(i, "name", e.target.value)}
                        placeholder={`Topic ${i + 1}, e.g. Thermodynamics`}
                        className="flex-1 bg-input border-border text-sm"
                      />
                      {topics.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTopic(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </Button>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Confidence</span>
                        <span className="text-foreground">
                          {CONFIDENCE_EMOJIS[topic.confidence - 1]}{" "}
                          {CONFIDENCE_LABELS[topic.confidence - 1]}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {CONFIDENCE_EMOJIS.map((emoji, ci) => (
                          <button
                            key={ci}
                            onClick={() => updateTopic(i, "confidence", ci + 1)}
                            className={`flex-1 py-2 rounded-lg text-xl transition-all border ${
                              topic.confidence === ci + 1
                                ? "bg-primary/20 border-primary scale-110"
                                : "bg-muted border-border hover:bg-accent"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full border-dashed border-border"
              onClick={addTopic}
            >
              + Add another topic
            </Button>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const valid = topics.filter((t) => t.name.trim());
                  if (valid.length === 0) {
                    setError("Add at least one topic");
                    return;
                  }
                  if (valid.length < topics.length) {
                    toast.info(
                      `${topics.length - valid.length} topic${topics.length - valid.length !== 1 ? "s" : ""} without a name will be skipped.`
                    );
                  }
                  setError("");
                  setStep(3);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">How many hours per day?</h2>
              <p className="text-muted-foreground text-sm">
                Be realistic — not aspirational.
              </p>
            </div>

            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center space-y-4">
                <div className="text-6xl font-bold text-primary">{dailyHours}</div>
                <div className="text-muted-foreground text-sm">hours per day</div>
                <Slider
                  min={1}
                  max={8}
                  step={0.5}
                  value={dailyHours}
                  onValueChange={(val) =>
                    setDailyHours(Array.isArray(val) ? (val[0] ?? dailyHours) : val)
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 hr</span>
                  <span>8 hrs</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
                {[
                  ["Subject", subject],
                  ["Exam date", examDate],
                  ["Topics", String(topics.filter((t) => t.name.trim()).length)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span>{label}</span>
                    <span className="text-foreground">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button className="flex-1" onClick={handleGenerate}>
                Build My Plan ✨
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
