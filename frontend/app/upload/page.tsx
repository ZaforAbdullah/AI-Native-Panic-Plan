"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { analyzePdf, createPlan, savePlanFromSessions, ingestPlanContent } from "@/lib/api";
import type { PdfAnalysis, ExtractedTopic } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Phase = "idle" | "ready" | "analyzing" | "review" | "generating";

const IMPORTANCE_CONFIG = {
  critical: { label: "Critical", color: "bg-red-500/20 text-red-400 border-red-500/30", dot: "bg-red-400" },
  high:     { label: "High",     color: "bg-amber-500/20 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  medium:   { label: "Medium",   color: "bg-primary/20 text-primary border-primary/30", dot: "bg-primary" },
  low:      { label: "Low",      color: "bg-white/10 text-muted-foreground/70 border-border", dot: "bg-white/20" },
};

const CONFIDENCE_EMOJIS = ["😰", "😟", "😐", "🙂", "💪"];

const TERMINAL_STEPS = [
  "Opening document...",
  "Parsing PDF structure...",
  "Extracting text content...",
  "Identifying subject and domain...",
  "Mapping topic structure...",
  "Analysing concept dependencies...",
  "Estimating difficulty distribution...",
  "Detecting exam signals...",
  "Building study intelligence...",
  "Calculating optimal study order...",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TerminalLog({ visible }: { visible: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const idx = useRef(0);

  useEffect(() => {
    if (!visible) { setLines([]); idx.current = 0; return; }
    const add = () => {
      if (idx.current < TERMINAL_STEPS.length) {
        setLines((prev) => [...prev, TERMINAL_STEPS[idx.current]]);
        idx.current++;
        setTimeout(add, 420 + Math.random() * 280);
      }
    };
    setTimeout(add, 200);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="bg-black/60 border border-border rounded-xl p-5 font-mono text-sm overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/60" />
          <span className="w-3 h-3 rounded-full bg-amber-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <span className="text-muted-foreground/60 text-xs">panicplan — analysis</span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2 text-green-400/80">
            <span className="text-green-500/50 shrink-0">›</span>
            <span>{line}</span>
            {i === lines.length - 1 && (
              <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
            )}
          </div>
        ))}
        {lines.length === 0 && (
          <span className="text-muted-foreground/40 animate-pulse">Initialising AI engine...</span>
        )}
      </div>
    </div>
  );
}

// ── Topic card ────────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  index,
  onChange,
  onRemove,
}: {
  topic: ExtractedTopic & { id: string };
  index: number;
  onChange: (id: string, field: keyof ExtractedTopic, value: string | number) => void;
  onRemove: (id: string) => void;
}) {
  const [showDesc, setShowDesc] = useState(false);
  const imp = IMPORTANCE_CONFIG[topic.importance] ?? IMPORTANCE_CONFIG.medium;

  return (
    <Card
      className={cn(
        "border transition-all hover:border-border",
        topic.importance === "critical"
          ? "bg-red-500/5 border-red-500/20"
          : topic.importance === "high"
          ? "bg-amber-500/5 border-amber-500/20"
          : "bg-muted/50 border-border"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn("text-xs px-2 py-0.5 rounded-full border", imp.color)}>
                {imp.label}
              </span>
              <span className="text-muted-foreground/60 text-xs">~{topic.estimated_hours}h</span>
              {topic.description && (
                <button
                  onClick={() => setShowDesc(!showDesc)}
                  className="text-muted-foreground/60 hover:text-foreground/60 text-xs transition"
                >
                  {showDesc ? "▲ hide" : "▼ details"}
                </button>
              )}
            </div>

            <input
              value={topic.name}
              onChange={(e) => onChange(topic.id, "name", e.target.value)}
              className="w-full bg-transparent border-b border-border focus:border-primary text-white font-medium text-sm py-1 outline-none transition mb-2"
            />

            {showDesc && topic.description && (
              <p className="text-muted-foreground text-xs leading-relaxed mb-2">{topic.description}</p>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/60 text-xs mr-1">Confidence:</span>
              {CONFIDENCE_EMOJIS.map((emoji, ci) => (
                <button
                  key={ci}
                  onClick={() => onChange(topic.id, "suggested_confidence", ci + 1)}
                  className={cn(
                    "w-7 h-7 rounded-md text-base transition-all border",
                    topic.suggested_confidence === ci + 1
                      ? "bg-primary/30 border-primary scale-110"
                      : "bg-muted/50 border-border hover:bg-white/10"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onRemove(topic.id)}
            className="text-muted-foreground/40 hover:text-red-400 transition text-lg shrink-0 mt-1"
          >
            ×
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);

  // Editable review fields
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState(2);
  const [topics, setTopics] = useState<(ExtractedTopic & { id: string })[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split("T")[0];

  const processFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25 MB).");
      return;
    }
    setFile(f);
    setPhase("analyzing");

    try {
      const result = await analyzePdf(f);
      setAnalysis(result);
      setSubject(result.subject || "");
      setExamDate(result.exam_date_hint || "");
      setDailyHours(Math.round(result.daily_hours_suggestion * 2) / 2);
      setTopics(
        (result.topics ?? []).map((t, i) => ({
          ...t,
          id: `topic-${i}-${Date.now()}`,
        }))
      );
      setPhase("review");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setPhase("ready");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const updateTopic = (id: string, field: keyof ExtractedTopic, value: string | number) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const removeTopic = (id: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const addTopic = () => {
    setTopics((prev) => [
      ...prev,
      {
        id: `topic-manual-${Date.now()}`,
        name: "New topic",
        suggested_confidence: 1,
        importance: "medium",
        description: "",
        estimated_hours: 1,
      },
    ]);
  };

  const handleGenerate = async () => {
    if (!subject.trim()) { toast.error("Enter a subject name."); return; }
    if (!examDate) { toast.error("Pick an exam date."); return; }
    if (topics.length === 0) { toast.error("Add at least one topic."); return; }
    if (topics.some((t) => !t.name.trim())) { toast.error("Every topic needs a name."); return; }

    if (!isAuthenticated) {
      toast.info("Create a free account to save your plan.");
      router.push(`/auth/register?next=/upload`);
      return;
    }

    setPhase("generating");

    const topicInputs = topics.map((t) => ({
      name: t.name.trim(),
      confidence: t.suggested_confidence,
    }));

    try {
      // Stream generation via Next.js route
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, examDate, topics: topicInputs, dailyHours }),
      });

      if (!res.ok || !res.body) throw new Error("Generation failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
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

      let plan;
      try {
        const sessions = parseSessionsFromText(fullText);
        plan = await savePlanFromSessions({
          subject,
          exam_date: examDate,
          topics: topicInputs,
          daily_hours: dailyHours,
          sessions,
        });
      } catch {
        plan = await createPlan({
          subject,
          exam_date: examDate,
          topics: topicInputs,
          daily_hours: dailyHours,
        });
      }

      // Seed the plan's RAG vector store with the AI-extracted analysis
      if (analysis) {
        const ragContent = [
          `Subject: ${subject}`,
          analysis.key_insight ? `Key insight: ${analysis.key_insight}` : "",
          analysis.exam_tips?.length
            ? `Exam tips:\n${analysis.exam_tips.map((t) => `- ${t}`).join("\n")}`
            : "",
          "Topics:",
          ...topics.map((t) =>
            `${t.name} (${t.importance} importance): ${t.description ?? ""}`
          ),
        ]
          .filter(Boolean)
          .join("\n\n");
        ingestPlanContent(plan.id, ragContent, "pdf").catch(() => {});
      }

      toast.success("Your study plan is ready!");
      router.push(`/plan/${plan.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create plan.");
      setPhase("review");
    }
  };

  const criticalCount = topics.filter((t) => t.importance === "critical").length;
  const highCount = topics.filter((t) => t.importance === "high").length;
  const totalHours = topics.reduce((a, t) => a + (t.estimated_hours ?? 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur px-6">
        <div className="max-w-3xl mx-auto h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Panic<span className="text-primary">Plan</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/onboarding" className="text-muted-foreground/70 hover:text-white text-sm transition">
              Enter manually instead
            </Link>
            {isAuthenticated && (
              <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                My Plans
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* ── idle + ready: drop zone ── */}
        {(phase === "idle" || phase === "ready") && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold mb-3">
                Upload your{" "}
                <span className="text-primary">study material</span>
              </h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Drop a syllabus, lecture notes, textbook chapter, or past exam.
                AI extracts topics, estimates difficulty, and builds your schedule automatically.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : file
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border bg-muted/50 hover:border-primary/50 hover:bg-primary/5"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {!file ? (
                <>
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-xl font-semibold mb-2">Drop your PDF here</p>
                  <p className="text-muted-foreground/70 text-sm">or click to browse</p>
                  <p className="text-muted-foreground/40 text-xs mt-3">
                    Syllabus · Lecture notes · Textbook chapter · Past exam · Max 25 MB
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">✅</div>
                  <p className="font-semibold text-lg">{file.name}</p>
                  <p className="text-muted-foreground/70 text-sm mt-1">{formatBytes(file.size)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPhase("idle"); }}
                    className="mt-3 text-xs text-muted-foreground/60 hover:text-foreground/60 transition"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>

            {file && (
              <Button className="w-full py-6 text-lg" onClick={() => processFile(file)}>
                🧠 Analyse with AI
              </Button>
            )}

            {/* What works well */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "📋", label: "Syllabus", hint: "Auto-detects topics & exam dates" },
                { icon: "📖", label: "Lecture notes", hint: "Extracts key concepts" },
                { icon: "📝", label: "Past exams", hint: "Identifies high-weight topics" },
              ].map((c) => (
                <Card key={c.label} className="bg-muted/50 border-border text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl mb-1">{c.icon}</div>
                    <div className="font-medium text-sm">{c.label}</div>
                    <div className="text-muted-foreground/70 text-xs mt-0.5">{c.hint}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── analyzing: terminal animation ── */}
        {phase === "analyzing" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary text-sm font-medium">LLM is reading your PDF…</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">Analysing study material</h2>
              <p className="text-muted-foreground text-sm">{file?.name}</p>
            </div>

            <TerminalLog visible={phase === "analyzing"} />

            <p className="text-center text-muted-foreground/60 text-xs animate-pulse">
              Usually takes 10–30 seconds depending on document length
            </p>
          </div>
        )}

        {/* ── review: extracted topics ── */}
        {phase === "review" && analysis && (
          <div className="space-y-8">
            {/* Intelligence summary */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-2xl font-bold">Review your study plan</h2>
                  <p className="text-muted-foreground text-sm">
                    AI extracted {topics.length} topics from your PDF. Edit anything.
                  </p>
                </div>
                <Badge className="shrink-0 bg-green-500/20 text-green-400 border-green-500/30 capitalize">
                  {analysis.difficulty_level}
                </Badge>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { n: topics.length, label: "Topics" },
                  { n: `${criticalCount + highCount}`, label: "Exam-critical" },
                  { n: `~${Math.round(totalHours)}h`, label: "Est. total" },
                  { n: analysis.document_type.replace("_", " "), label: "Document" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/50 border border-border rounded-xl p-3 text-center">
                    <div className="font-bold text-primary capitalize">{s.n}</div>
                    <div className="text-muted-foreground/70 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Key insight */}
              {analysis.key_insight && (
                <Card className="bg-primary/10 border-primary/30 mb-4">
                  <CardContent className="p-4 flex gap-3">
                    <span className="text-xl shrink-0">💡</span>
                    <div>
                      <p className="text-xs text-primary font-medium uppercase tracking-wide mb-1">AI Insight</p>
                      <p className="text-foreground/80 text-sm">{analysis.key_insight}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Exam tips */}
              {analysis.exam_tips && analysis.exam_tips.length > 0 && (
                <details className="mb-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground/80 transition select-none">
                    ▶ {analysis.exam_tips.length} AI exam tips
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-4">
                    {analysis.exam_tips.map((tip, i) => (
                      <li key={i} className="text-sm text-foreground/60 flex items-start gap-2">
                        <span className="text-primary shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Plan settings */}
            <Card className="bg-muted/50 border-border">
              <CardContent className="p-5 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Subject name</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Organic Chemistry II"
                      className="bg-muted/50 border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Exam date</Label>
                    <Input
                      type="date"
                      min={today}
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="bg-muted/50 border-border"
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Daily study hours</Label>
                    <span className="text-primary font-bold">{dailyHours}h</span>
                  </div>
                  <Slider
                    min={1}
                    max={8}
                    step={0.5}
                    value={dailyHours}
                    onValueChange={(val) => setDailyHours(Array.isArray(val) ? (val[0] ?? dailyHours) : val)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground/60">
                    <span>1h</span><span>8h</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Topics */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Topics</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />Critical
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />High
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />Medium
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {topics.map((topic, i) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    index={i}
                    onChange={updateTopic}
                    onRemove={removeTopic}
                  />
                ))}
              </div>

              <button
                onClick={addTopic}
                className="mt-3 w-full py-2.5 border border-dashed border-border rounded-xl text-muted-foreground/70 hover:border-white/40 hover:text-white/70 transition text-sm"
              >
                + Add topic manually
              </button>
            </div>

            <div className="sticky bottom-4">
              <Button
                className="w-full py-6 text-lg shadow-lg shadow-[#5b8eff]/20"
                onClick={handleGenerate}
                disabled={!subject || !examDate || topics.length === 0}
              >
                ✨ Generate My Schedule
              </Button>
            </div>
          </div>
        )}

        {/* ── generating ── */}
        {phase === "generating" && (
          <div className="text-center py-24 space-y-6">
            <div className="text-6xl animate-bounce">✨</div>
            <h2 className="text-2xl font-bold">Building your schedule…</h2>
            <p className="text-muted-foreground">
              AI is crafting a day-by-day plan for{" "}
              <span className="text-foreground font-medium">{subject}</span>
            </p>
            <p className="text-muted-foreground/60 text-sm animate-pulse">This takes about 30 seconds</p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── JSON parser (shared with onboarding) ──────────────────────────────────────

function parseSessionsFromText(text: string) {
  let content = text.trim();
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) content = fenceMatch[1].trim();
  const start = content.indexOf("{");
  if (start !== -1) content = content.slice(start);
  const data = JSON.parse(content);
  return (data.sessions ?? []) as {
    topic_name: string;
    date: string;
    duration_minutes: number;
    session_type: string;
    notes?: string;
  }[];
}
