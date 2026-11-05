"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Missing token", "Open the link from your email again.");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Weak password", "Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.warning("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      toast.success(
        "Password updated",
        result.message || "You can sign in with your new password.",
      );
      router.replace("/login");
    } catch (err) {
      toast.error("Reset failed", err instanceof Error ? err.message : "Link may be expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
        <div className="landing-grid" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-6 flex justify-center">
          <Image
            src="/brand/logo-mark.png"
            alt="SR Social Hub"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
            priority
          />
        </div>
        <p className="landing-eyebrow text-center text-[11px] font-semibold uppercase tracking-[0.28em]">
          New password
        </p>
        <h1 className="landing-heading mt-3 text-center font-display text-3xl font-semibold">
          Reset password
        </h1>
        <form
          noValidate
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[0_0_40px_rgba(255,176,32,0.08)] backdrop-blur sm:p-6"
        >
          <label className="block text-xs text-content-muted">
            New password
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </label>
          <label className="block text-xs text-content-muted">
            Confirm password
            <input
              className="field"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
            />
          </label>
          <button disabled={loading} className="landing-cta w-full px-4 py-3 text-sm font-semibold">
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-content-muted">
          <Link href="/login" className="text-brand-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="landing flex min-h-screen items-center justify-center text-content-muted">
          Loading…
        </main>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
