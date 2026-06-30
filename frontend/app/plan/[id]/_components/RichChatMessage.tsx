"use client";

import { useState } from "react";

// Renders code blocks, **bold**, inline `code`, with a copy button.
export function RichChatMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Split on fenced code blocks first
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="px-3.5 py-2.5 space-y-2 relative group">
      {segments.map((seg, si) => {
        if (seg.startsWith("```")) {
          const lines = seg.slice(3).split("\n");
          const lang = lines[0].trim();
          const code = lines.slice(1).join("\n").replace(/```$/, "").trimEnd();
          return (
            <div key={si} className="bg-black/40 border border-border rounded-lg overflow-hidden my-1">
              {lang && (
                <div className="px-3 py-1 text-xs text-muted-foreground/60 bg-muted/50 border-b border-border font-mono">
                  {lang}
                </div>
              )}
              <pre className="p-3 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre">
                {code}
              </pre>
            </div>
          );
        }
        // Inline parsing: **bold**, `code`, line breaks
        const lines = seg.split("\n");
        return (
          <div key={si} className="space-y-1">
            {lines.map((line, li) => {
              if (!line) return <div key={li} className="h-1" />;
              const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
              return (
                <p key={li}>
                  {parts.map((part, pi) => {
                    if (part.startsWith("**") && part.endsWith("**"))
                      return <strong key={pi}>{part.slice(2, -2)}</strong>;
                    if (part.startsWith("`") && part.endsWith("`"))
                      return (
                        <code key={pi} className="bg-white/10 text-[#a0c4ff] rounded px-1 font-mono text-xs">
                          {part.slice(1, -1)}
                        </code>
                      );
                    return <span key={pi}>{part}</span>;
                  })}
                </p>
              );
            })}
          </div>
        );
      })}

      {/* Copy button — only visible on hover */}
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground/60 hover:text-white/70 bg-muted/50 rounded px-2 py-0.5"
      >
        {copied ? "✓" : "copy"}
      </button>
    </div>
  );
}
