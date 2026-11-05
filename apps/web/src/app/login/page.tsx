"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "@/components/toast";
import { loginRequest, setSessionUser, setToken } from "@/lib/api";
import { isEmail, requireFields } from "@/lib/validate";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !requireFields([
        { label: "Email", value: email, ok: isEmail(email) },
        { label: "Password", value: password },
      ])
    ) {
      return;
    }
    setLoading(true);
    try {
      const result = await loginRequest(email, password, false);
      setToken(result.accessToken);
      setSessionUser(result.user);
      toast.success("Welcome back", "Signing you into your workspace…");
      router.replace(result.redirectTo);
    } catch (err) {
      toast.error(
        "Sign in failed",
        err instanceof Error ? err.message : "Check your email and password.",
      );
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

      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <section className="hidden lg:block">
          <Image
            src="/brand/logo.png"
            alt="SR Social Hub"
            width={220}
            height={220}
            className="mb-6 h-40 w-40 rounded-full object-cover ring-2 ring-brand-primary/40"
            priority
          />
          <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
            Workspace access
          </p>
          <h1 className="font-display mt-3 text-5xl font-semibold leading-tight tracking-tight text-white">
            Sign in to your <span className="landing-heading-underline">hub</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-content-muted">
            Agencies and clients share this portal. Activate your email first if you just registered.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Image
              src="/brand/logo-mark.png"
              alt="SR Social Hub"
              width={72}
              height={72}
              className="h-16 w-16 rounded-full object-cover"
              priority
            />
          </div>
          <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
            Sign in
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
            Welcome <span className="landing-heading-underline">back</span>
          </h2>
          <form
            noValidate
            onSubmit={onSubmit}
            className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[0_0_40px_rgba(0,210,255,0.08)] backdrop-blur sm:p-6"
          >
            <label className="block text-xs text-content-muted">
              Email
              <input
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Password
              <input
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </label>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-brand-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <button disabled={loading} className="landing-cta w-full px-4 py-3 text-sm font-semibold">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-content-muted">
            New here?{" "}
            <Link href="/register" className="text-brand-primary hover:underline">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
