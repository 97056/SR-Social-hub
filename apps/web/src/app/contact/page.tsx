"use client";

import { FormEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ContactPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/contact", {
        method: "POST",
        body: JSON.stringify({ contactName: form.get("name"), email: form.get("email"), notes: form.get("notes") }),
      });
      setMessage("Message received. It is in the admin inbox.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the message.");
    }
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-2 text-sm">For a negotiated plan, use the quote form. This inbox is for general questions.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
        <div><Label htmlFor="notes">Message</Label><textarea id="notes" name="notes" required className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2" rows={5} /></div>
        {message && <p className="text-sm">{message}</p>}
        {error && <p role="alert" className="text-sm text-accent">{error}</p>}
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
