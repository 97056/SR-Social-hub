"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "@/components/toast";
import { loginRequest, setSessionUser, setToken } from "@/lib/api";
import { isEmail, requireFields } from "@/lib/validate";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      const result = await loginRequest(email, password, true);
      setToken(result.accessToken);
      setSessionUser(result.user);
      toast.success("Welcome", "Entering admin…");
      router.replace("/admin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error("Sign in failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Image
        src="/brand/logo-mark.png"
        alt="SR Social Hub"
        width={72}
        height={72}
        className="mb-5 h-16 w-16 rounded-full object-cover"
        priority
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-primary">
        Protected admin
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold">Super Admin</h1>
      <p className="mt-2 text-sm text-content-muted">
        Plans, quotas, companies, and integrations — managed only here.
      </p>
      <form noValidate onSubmit={onSubmit} className="panel mt-8 space-y-4 p-5 sm:p-6">
        <label className="block text-sm">
          <span className="text-content-muted">Email</span>
          <input
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-content-muted">Password</span>
          <input
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
        </label>
        {error ? <p className="text-sm text-brand-error">{error}</p> : null}
        <button disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Verifying…" : "Enter admin"}
        </button>
      </form>
      <p className="mt-4 text-sm text-content-muted">
        <Link href="/login" className="text-brand-secondary hover:underline">
          Back to workspace login
        </Link>
      </p>
    </main>
  );
}
