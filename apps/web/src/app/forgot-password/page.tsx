"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { isEmail, requireFields } from "@/lib/validate";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!requireFields([{ label: "Email", value: email, ok: isEmail(email) }])) return;
    setLoading(true);
    try {
      const result = await apiFetch<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success(
        "Check your email",
        result.message || "If that email exists, a reset link was sent.",
      );
    } catch (err) {
      toast.error("Request failed", err instanceof Error ? err.message : "Please try again.");
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
          Password recovery
        </p>
        <h1 className="landing-heading mt-3 text-center font-display text-3xl font-semibold">
          Forgot password?
        </h1>
        <p className="mt-3 text-center text-sm text-content-muted">
          Enter your account email. We&apos;ll send a secure reset link that expires in 2 hours.
        </p>

        <form
          noValidate
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[0_0_40px_rgba(255,176,32,0.08)] backdrop-blur sm:p-6"
        >
          <label className="block text-xs text-content-muted">
            Email
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <button disabled={loading} className="landing-cta w-full px-4 py-3 text-sm font-semibold">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-content-muted">
          Remembered it?{" "}
          <Link href="/login" className="text-brand-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
