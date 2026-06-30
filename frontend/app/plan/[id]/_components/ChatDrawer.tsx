"use client";

import { useState, useEffect, useRef } from "react";
import { getChatHistory, saveChatMessage, clearChatHistory } from "@/lib/api";
import type { Plan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RichChatMessage } from "./RichChatMessage";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

export function ChatDrawer({ plan, initialTopic, onClose }: {
  plan: Plan; initialTopic?: string; onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("panicplan_token") ?? "" : "";

  useEffect(() => {
    if (historyLoaded) return;
    getChatHistory(plan.id)
      .then((history) => {
        if (history.length > 0) {
          setMessages(history.map((m) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [plan.id, historyLoaded]);

  useEffect(() => {
    if (initialTopic && historyLoaded && messages.length === 0) {
      const msg = `I'm about to study ${initialTopic}. Give me a quick overview of the most important things to know.`;
      send(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText("");
    setLoading(true);
    saveChatMessage(plan.id, "user", text.trim()).catch(() => {});

    const assistantId = (Date.now() + 1).toString();
    setMessages([...updatedMessages, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatMessages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          planId: plan.id,
          subject: plan.subject,
          examDate: plan.exam_date,
          topics: plan.topic_records.map((t) => ({ name: t.name, confidence: t.confidence })),
          topicFocus: initialTopic,
          token,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });

        // Backend yields error tokens when AI throws during streaming
        const errorMsg = full.includes("__ERROR__:quota_exceeded")
          ? "AI quota exceeded — please wait a moment and try again."
          : full.includes("__ERROR__:invalid_api_key")
          ? "Gemini API key is not configured. Check backend/.env"
          : full.includes("__ERROR__:")
          ? "AI temporarily unavailable. Try again in a moment."
          : null;

        if (errorMsg) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: errorMsg } : m))
          );
          setLoading(false);
          return;
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m))
        );
      }

      saveChatMessage(plan.id, "assistant", full).catch(() => {});
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId
          ? { ...m, content: "Sorry, something went wrong. Try again." }
          : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const QUICK = ["Quiz me on this", "Explain with an example", "What should I focus on?", "I don't understand"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[80vh]">
        {/* Handle + header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎓</span>
            <div>
              <p className="font-semibold text-sm">AI Tutor</p>
              {initialTopic && <p className="text-muted-foreground/70 text-xs">Focused on: {initialTopic}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={async () => { await clearChatHistory(plan.id); setMessages([]); }}
                className="text-muted-foreground/60 hover:text-foreground/60 text-xs transition"
              >
                Clear
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground/70 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="text-center py-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                Ask anything about <strong>{initialTopic || plan.subject}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="text-xs p-2.5 bg-muted/50 border border-border rounded-xl text-foreground/60 hover:text-white hover:border-primary/40 transition text-left">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <span className="text-base shrink-0 mt-0.5">🎓</span>
              )}
              <div className={cn(
                "max-w-[82%] rounded-2xl text-sm leading-relaxed group relative",
                m.role === "user"
                  ? "bg-primary text-white rounded-tr-sm px-3.5 py-2.5"
                  : "bg-muted/60 border border-border text-white/90 rounded-tl-sm"
              )}>
                {m.content ? (
                  m.role === "assistant"
                    ? <RichChatMessage content={m.content} />
                    : <span>{m.content}</span>
                ) : (
                  <div className="flex gap-1 px-3.5 py-2.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && messages.at(-1)?.role !== "assistant" && (
            <div className="flex gap-2 justify-start">
              <span className="text-base">🎓</span>
              <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick replies when there are messages */}
        {messages.length > 0 && (
          <div className="flex gap-2 px-4 pb-2 flex-wrap">
            {["Quiz me", "Explain more", "Give an example", "What's most important?"].map((q) => (
              <button key={q} onClick={() => send(q)} disabled={loading}
                className="text-xs px-3 py-1.5 bg-muted/50 border border-border rounded-full text-muted-foreground hover:text-white hover:border-white/30 disabled:opacity-40 transition">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(inputText); } }}
              placeholder="Ask anything…"
              disabled={loading}
              className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary transition"
            />
            <Button onClick={() => send(inputText)} disabled={loading || !inputText.trim()} className="px-4 shrink-0">
              {loading ? "…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
