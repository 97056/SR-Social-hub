"use client";

import { FormEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Message = { subject: string; body: string; createdAt: string };

export default function MailboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") || "");
    try {
      setMessages(await api<Message[]>(`/api/dev/mailbox?email=${encodeURIComponent(email)}`));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The development mailbox is only available in the local or embedded profile.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Development mailbox</h1>
      <p className="mt-2 rounded-brand bg-accent px-4 py-3 text-sm text-accent-foreground">Local only. These messages are not delivered to an external inbox, and this page must stay off in production.</p>
      <form onSubmit={onSubmit} className="mt-6 flex items-end gap-3">
        <div className="flex-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
        <Button type="submit">Show</Button>
      </form>
      {error && <p className="mt-4 text-sm">{error}</p>}
      <ul className="mt-6 space-y-4">
        {messages.map((message) => (
          <li key={message.createdAt + message.subject} className="rounded-brand bg-surface p-4">
            <p className="font-semibold">{message.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{message.body}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
