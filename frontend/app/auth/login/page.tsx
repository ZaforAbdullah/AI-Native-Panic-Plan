"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Back to landing */}
      <div className="p-5">
        <Link href="/" className="logo text-base hover:opacity-70 transition-opacity">
          <em>panic</em><span className="dot">·</span>plan
        </Link>
      </div>

      <div className="flex-1 grid md:grid-cols-[1.1fr_1fr] max-w-5xl mx-auto w-full px-6 py-8 gap-16 items-center">

        {/* Left — serif editorial panel */}
        <div className="hidden md:flex flex-col justify-between py-8">
          <div>
            <p className="meta mb-6">Good to have you back</p>
            <blockquote className="font-serif text-3xl leading-[1.2] tracking-tight text-foreground max-w-[22ch]">
              The hardest part is sitting down.
              <br />
              <em className="text-muted-foreground">Everything else follows.</em>
            </blockquote>
          </div>
          <div className="mt-16 text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--sage)" }}>✓</span> Lessons for every topic
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--sage)" }}>✓</span> AI tutor that knows your syllabus
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--sage)" }}>✓</span> Adapts when life gets in the way
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full max-w-sm mx-auto md:mx-0">
          <h1 className="font-serif font-normal text-4xl tracking-tight mb-1">
            Welcome <em className="text-muted-foreground">back</em>
          </h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--teal)" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            No account?{" "}
            <Link href="/auth/register" style={{ color: "var(--teal)" }} className="hover:underline">
              Start for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
