"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function VerifyForm() {
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token: form.get("token") }) });
      setMessage("Email verified. You can sign in.");
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm">Paste the token from your verification message{params.get("email") ? ` for ${params.get("email")}` : ""}. In local development, open the dev mailbox.</p>
      <div><Label htmlFor="token">Verification token</Label><Input id="token" name="token" required defaultValue={params.get("token") ?? ""} /></div>
      {message && <p className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button type="submit">Verify email</Button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Verify email</h1>
      <div className="mt-6">
        <Suspense fallback={<p>Loading…</p>}><VerifyForm /></Suspense>
      </div>
    </div>
  );
}
