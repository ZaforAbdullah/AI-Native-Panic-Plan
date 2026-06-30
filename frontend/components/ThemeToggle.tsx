"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("pp-theme", next ? "dark" : "light"); } catch { /* ignore */ }
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
        text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
    >
      {dark ? "☀" : "◑"}
    </button>
  );
}
