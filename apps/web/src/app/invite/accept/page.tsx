"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/toast";
import { apiFetch, setToken } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";
import { requireFields } from "@/lib/validate";

function AcceptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !requireFields([
        { label: "Full name", value: fullName },
        { label: "Password", value: password, ok: password.length >= 8 },
      ])
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<LoginResponse>("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, fullName, password }),
      });
      setToken(result.accessToken);
      toast.success("Welcome", "Joining workspace…");
      router.replace(result.redirectTo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Accept failed";
      setError(msg);
      toast.error("Accept failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-secondary">
        Invitation
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">Accept invite</h1>
      <form noValidate onSubmit={onSubmit} className="panel mt-8 space-y-4 p-5">
        <label className="block text-sm">
          <span className="text-content-muted">Full name</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2.5"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-content-muted">Create password</span>
          <input
            type="password"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
        </label>
        {error ? <p className="text-sm text-brand-error">{error}</p> : null}
        <button
          disabled={loading || !token}
          className="w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Accepting…" : "Join workspace"}
        </button>
      </form>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}>
      <AcceptForm />
    </Suspense>
  );
}
