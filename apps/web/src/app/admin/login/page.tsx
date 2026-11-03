"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginRequest, setToken } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@srsocialhub.local");
  const [password, setPassword] = useState("ChangeMeAdmin!123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginRequest(email, password, true);
      setToken(result.accessToken);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-warning">
        Protected admin
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">Super Admin</h1>
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-5">
        <label className="block text-sm">
          <span className="text-content-muted">Email</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2.5 outline-none ring-brand-primary focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-content-muted">Password</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2.5 outline-none ring-brand-primary focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error ? <p className="text-sm text-brand-error">{error}</p> : null}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Enter admin"}
        </button>
      </form>
      <p className="mt-4 text-sm text-content-muted">
        <Link href="/login" className="text-brand-secondary">
          Back to workspace login
        </Link>
      </p>
    </main>
  );
}
