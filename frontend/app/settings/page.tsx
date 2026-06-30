"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { changePassword, deleteAccount } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/auth/login"); return; }
    const token = localStorage.getItem("panicplan_token");
    fetch(`${API}/user/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setEmail(d.email ?? ""))
      .catch(() => {});
  }, [isAuthenticated, authLoading, router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("Passwords don't match."); return; }
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters."); return; }
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      toast.success("Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      logout();
      toast.success("Account deleted.");
      router.push("/");
    } catch {
      toast.error("Failed to delete account.");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8">
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your account?"
        description="This permanently deletes all your plans, sessions, lessons, and chat history. There is no undo."
        confirmLabel="Delete everything"
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="max-w-xl mx-auto space-y-8">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-muted-foreground"}>
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
          <div className="w-20" />
        </div>

        {/* Account info */}
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-5 space-y-2">
            <p className="text-xs text-muted-foreground/70 uppercase tracking-widest">Account</p>
            <p className="font-medium">{email || "Loading…"}</p>
            <p className="text-muted-foreground/70 text-xs">Free beta plan · unlimited exams</p>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground/70 uppercase tracking-widest mb-4">Change Password</p>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className="bg-muted/50 border-border"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type="password"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="min 6 characters"
                  className="bg-muted/50 border-border"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="repeat new password"
                  className="bg-muted/50 border-border"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={changingPw}>
                {changingPw ? "Changing…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* App preferences */}
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground/70 uppercase tracking-widest">App</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Install on home screen</p>
                <p className="text-muted-foreground/70 text-xs">Works offline, faster startup</p>
              </div>
              <button
                onClick={() => {
                  // Trigger PWA install prompt if available
                  const ev = (window as unknown as { _deferredPrompt?: { prompt: () => void } })._deferredPrompt;
                  if (ev) { ev.prompt(); }
                  else { toast.info("Open this site in your browser → Share → Add to Home Screen"); }
                }}
                className="text-xs px-3 py-1.5 bg-primary/20 border border-primary/30 text-primary rounded-lg hover:bg-primary/30 transition"
              >
                Install app
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-red-400 uppercase tracking-widest">Danger Zone</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="text-muted-foreground/70 text-xs">Permanently removes all your data</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete account
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground/40 text-xs">
          PanicPlan · Built for students · Free during beta
        </p>
      </div>
    </main>
  );
}
