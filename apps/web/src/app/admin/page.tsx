"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminHome() {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    api<Record<string, number>>("/api/admin/overview").then(setOverview).catch((err) => {
      if (err instanceof ApiError && err.code === "mfa_enrollment_required") setNeedsMfa(true);
      setError(err instanceof ApiError ? err.message : "Admin access was refused.");
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">SR Social Admin</h1>
      <p className="mt-2 text-sm">Super admin is never granted by public signup. Admin routes also require an authenticator when that policy is on.</p>
      {needsMfa && <MfaEnrollment />}
      {error && <p className="mt-4 text-sm">{error}</p>}
      {overview && (
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {Object.entries(overview).map(([key, value]) => (
            <div key={key} className="rounded-brand bg-surface p-4">
              <dt className="text-sm capitalize">{key.replaceAll(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</dt>
              <dd className="text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <nav className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/admin/theme">Appearance</Link>
        <Link className="underline" href="/admin/integrations">Integrations</Link>
        <Link className="underline" href="/admin/quotes">Quotes</Link>
      </nav>
    </div>
  );
}

function MfaEnrollment() {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");

  async function start() {
    try {
      const setup = await api<{ secret: string; otpauthUrl: string }>("/api/auth/mfa/setup", { method: "POST" });
      setSecret(setup.secret);
      setMessage("Add this secret to an authenticator, then enter the current code. The secret is shown once.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not start authenticator setup.");
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") || "");
    try {
      await api("/api/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) });
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "That code was not accepted.");
    }
  }

  return (
    <section className="mt-6 max-w-lg rounded-brand bg-surface p-4">
      <h2 className="text-xl font-semibold">Turn on an authenticator</h2>
      <p className="mt-2 text-sm">Admin pages stay closed until this account has a verified authenticator.</p>
      <Button className="mt-4" type="button" onClick={start}>Generate secret</Button>
      {secret && <p className="mt-4 break-all font-mono text-sm">{secret}</p>}
      {secret && (
        <form onSubmit={confirm} className="mt-4 space-y-3">
          <div><Label htmlFor="code">Authenticator code</Label><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required /></div>
          <Button type="submit">Confirm</Button>
        </form>
      )}
      {message && <p className="mt-3 text-sm">{message}</p>}
    </section>
  );
}
