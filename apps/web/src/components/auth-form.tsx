"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          acceptTerms: form.get("acceptTerms") === "on",
        }),
      });
      router.push(`/verify-email?email=${encodeURIComponent(String(form.get("email")))}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required autoComplete="name" /></div>
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></div>
      <p className="text-sm">Use at least 10 characters with a letter and a number. Do not reuse a social account password.</p>
      <label className="flex items-start gap-2 text-sm">
        <input id="acceptTerms" name="acceptTerms" type="checkbox" required className="mt-1" />
        <span>I agree to the <a className="underline" href="/legal/terms">terms</a> and <a className="underline" href="/legal/privacy">privacy draft</a>.</span>
      </label>
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button disabled={pending} type="submit">{pending ? "Creating…" : "Create account"}</Button>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [mfa, setMfa] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), otp: form.get("otp") || undefined }),
      });
      router.push("/app");
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required") {
        setMfa(true);
        setError("Enter the code from your authenticator.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not sign in.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="username" /></div>
      <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
      {mfa && <div><Label htmlFor="otp">Authenticator code</Label><Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" /></div>}
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
