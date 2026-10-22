"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email: form.get("email") }) });
    setSent(true);
  }
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Reset password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
        <Button type="submit">Send reset link</Button>
        {sent && <p className="text-sm">If an account exists, a reset message was queued. The response is the same either way.</p>}
      </form>
    </div>
  );
}
