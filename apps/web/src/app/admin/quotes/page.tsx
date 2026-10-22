"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Quote = {
  id: string;
  source: string;
  company?: string | null;
  contactName: string;
  email: string;
  phone?: string | null;
  clientCount?: number | null;
  accountCount?: number | null;
  monthlyVolume?: number | null;
  platforms?: string | null;
  notes?: string | null;
  status: string;
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState("");

  function load() {
    api<Quote[]>("/api/admin/quotes").then(setQuotes).catch((err) => setError(err instanceof ApiError ? err.message : "Could not load quotes."));
  }
  useEffect(load, []);

  async function update(id: string, status: string) {
    await api(`/api/admin/quotes/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Quote inbox</h1>
      {error && <p className="mt-4 text-sm">{error}</p>}
      <ul className="mt-6 space-y-4">
        {quotes.map((quote) => (
          <li key={quote.id} className="rounded-brand bg-surface p-4">
            <p className="font-semibold">{quote.company || quote.contactName} · {quote.status}</p>
            <p className="text-sm">{quote.contactName} · {quote.email}{quote.phone ? ` · ${quote.phone}` : ""}</p>
            <p className="mt-2 text-sm">{quote.clientCount ?? "—"} clients, {quote.accountCount ?? "—"} accounts, {quote.monthlyVolume ?? "—"} posts. {quote.platforms}</p>
            {quote.notes && <p className="mt-2 text-sm">{quote.notes}</p>}
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="outline" onClick={() => update(quote.id, "contacted")}>Mark contacted</Button>
              <Button type="button" variant="ghost" onClick={() => update(quote.id, "closed")}>Close</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
