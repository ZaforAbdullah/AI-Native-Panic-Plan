import { cn } from "@/lib/utils";

// Renders \n as line breaks and highlights inline `code`/formulas.
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={cn("text-sm leading-relaxed space-y-1.5", className)}>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(`[^`]+`)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith("`") && part.endsWith("`") ? (
                <code key={j} className="bg-white/10 text-[#a0c4ff] rounded px-1 font-mono text-xs">
                  {part.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}
