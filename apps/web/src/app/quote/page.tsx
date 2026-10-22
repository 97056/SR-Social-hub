"use client";

import { FormEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const platforms = ["Facebook", "Instagram", "LinkedIn", "YouTube", "X", "Pinterest", "Threads"];

export default function QuotePage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const selected = platforms.filter((platform) => data.get(platform) === "on");
    try {
      await api("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          company: data.get("company"),
          contactName: data.get("contactName"),
          email: data.get("email"),
          phone: data.get("phone"),
          clientCount: Number(data.get("clientCount") || 0),
          accountCount: Number(data.get("accountCount") || 0),
          monthlyVolume: Number(data.get("monthlyVolume") || 0),
          platforms: selected.join(", "),
          notes: data.get("notes"),
        }),
      });
      setMessage("Request received. An acknowledgement was queued, and the lead is in the admin inbox.");
      setError("");
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the request.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Request a quote</h1>
      <p className="mt-2 text-sm">Custom plans are negotiated. This form does not start a subscription.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label htmlFor="company">Company</Label><Input id="company" name="company" required /></div>
        <div><Label htmlFor="contactName">Contact name</Label><Input id="contactName" name="contactName" required /></div>
        <div><Label htmlFor="email">Business email</Label><Input id="email" name="email" type="email" required /></div>
        <div><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" name="phone" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="clientCount">Clients</Label><Input id="clientCount" name="clientCount" type="number" min={0} /></div>
          <div><Label htmlFor="accountCount">Accounts</Label><Input id="accountCount" name="accountCount" type="number" min={0} /></div>
          <div><Label htmlFor="monthlyVolume">Posts / month</Label><Input id="monthlyVolume" name="monthlyVolume" type="number" min={0} /></div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Platforms</legend>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {platforms.map((platform) => (
              <label key={platform} className="flex items-center gap-2"><input type="checkbox" name={platform} />{platform}</label>
            ))}
          </div>
        </fieldset>
        <div><Label htmlFor="notes">Notes</Label><textarea id="notes" name="notes" className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2" rows={4} /></div>
        {message && <p className="text-sm">{message}</p>}
        {error && <p role="alert" className="text-sm text-accent">{error}</p>}
        <Button type="submit">Send request</Button>
      </form>
    </div>
  );
}
