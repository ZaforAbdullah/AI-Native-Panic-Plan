"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      router.push("/upload");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="p-5">
        <Link href="/" className="logo text-base hover:opacity-70 transition-opacity">
          <em>panic</em><span className="dot">·</span>plan
        </Link>
      </div>

      <div className="flex-1 grid md:grid-cols-[1.1fr_1fr] max-w-5xl mx-auto w-full px-6 py-8 gap-16 items-center">

        {/* Left — editorial panel */}
        <div className="hidden md:flex flex-col justify-between py-8">
          <div>
            <p className="meta mb-6">Two minutes to a study plan</p>
            <blockquote className="font-serif text-3xl leading-[1.2] tracking-tight text-foreground max-w-[22ch]">
              Your syllabus already has the answers.
              <br />
              <em className="text-muted-foreground">Let's find them together.</em>
            </blockquote>
          </div>
          <div className="mt-16 space-y-4">
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--teal-soft)", borderColor: "transparent" }}
            >
              <p
                className="font-mono text-xs tracking-widest uppercase mb-1"
                style={{ color: "var(--teal)" }}
              >
                Free during beta
              </p>
              <p className="text-sm text-foreground">
                Unlimited plans, all features, no card required.
              </p>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full max-w-sm mx-auto md:mx-0">
          <h1 className="font-serif font-normal text-4xl tracking-tight mb-1">
            Create an <em className="text-muted-foreground">account</em>
          </h1>
          <p className="text-sm text-muted-foreground mb-8">Free, no card required</p>

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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--teal)" }}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/auth/login" style={{ color: "var(--teal)" }} className="hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
