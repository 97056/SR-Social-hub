"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Client = { id: string; name: string; timezone: string; notes?: string };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState("");

  function load() {
    api<Client[]>("/api/clients").then(setClients).catch((err) => setError(err instanceof ApiError ? err.message : "Could not load clients."));
  }
  useEffect(load, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/api/clients", { method: "POST", body: JSON.stringify({ name: data.get("name"), timezone: data.get("timezone"), notes: data.get("notes") }) });
      form.reset();
      setError("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the client.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
      <p className="mt-2 text-sm">The Agency plan includes six client profiles. The API rejects the seventh.</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-brand bg-surface p-4 md:grid-cols-4">
        <div className="md:col-span-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
        <div><Label htmlFor="timezone">Timezone</Label><Input id="timezone" name="timezone" defaultValue="Asia/Kolkata" required /></div>
        <div className="flex items-end"><Button type="submit">Add client</Button></div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}
      <ul className="mt-6 space-y-2">
        {clients.map((client) => <li key={client.id} className="rounded-brand border border-black/10 bg-surface px-4 py-3">{client.name} · {client.timezone}</li>)}
      </ul>
    </div>
  );
}
