"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "@/components/toast";
import { apiFetch, getSessionUser } from "@/lib/api";

type ChatMsg = { id: string; role: "bot" | "user"; text: string };

type AskResponse = {
  reply: string;
  suggestContact: boolean;
  supportEmail: string;
  quickReplies: string[];
};

function uid() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Floating helper for company + client portals (not Super Admin). */
export function SupportChatAgent() {
  const pathname = usePathname() || "";
  const enabled = pathname.startsWith("/app/") || pathname.startsWith("/client/");
  const session = getSessionUser();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [supportEmail, setSupportEmail] = useState("support@srsocialhub.in");
  const [quick, setQuick] = useState<string[]>([
    "How do I connect Instagram?",
    "How do client approvals work?",
    "I want to contact support",
  ]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [lead, setLead] = useState({
    name: session?.fullName || "",
    email: session?.email || "",
    phone: "",
    company: "",
    message: "",
  });
  const endRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(() => {
    const first = session?.fullName?.split(" ")[0];
    return `Hi${first ? ` ${first}` : ""}! Ask me anything about SR Social Hub — clients, social connects, posts, approvals, billing, SEO Workspace, and more. Or say “contact support” to leave a message.`;
  }, [session?.fullName]);

  useEffect(() => {
    if (!open || msgs.length) return;
    setMsgs([{ id: uid(), role: "bot", text: greeting }]);
  }, [open, msgs.length, greeting]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, showForm, open]);

  if (!enabled) return null;

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { id: uid(), role: "user", text }]);
    setBusy(true);
    try {
      const res = await apiFetch<AskResponse>("/support-chat/ask", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setSupportEmail(res.supportEmail || supportEmail);
      if (res.quickReplies?.length) setQuick(res.quickReplies);
      setMsgs((m) => [...m, { id: uid(), role: "bot", text: res.reply }]);
      if (res.suggestContact) setShowForm(true);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          id: uid(),
          role: "bot",
          text: `I couldn't reach support chat just now. Email ${supportEmail} or try again in a moment.`,
        },
      ]);
      toast.error("Chat failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function submitLead(e: FormEvent) {
    e.preventDefault();
    if (lead.message.trim().length < 5) {
      toast.error("Message too short", "Please write at least a few words.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/support-chat/contact", {
        method: "POST",
        body: JSON.stringify({
          name: lead.name || session?.fullName,
          email: lead.email || session?.email,
          phone: lead.phone,
          company: lead.company,
          message: lead.message,
        }),
      });
      setMsgs((m) => [
        ...m,
        {
          id: uid(),
          role: "bot",
          text: `Thanks — your message is in Admin → Contact Leads. Our team will follow up at ${lead.email || session?.email}. You can also email ${supportEmail}.`,
        },
      ]);
      setLead((prev) => ({ ...prev, message: "", phone: "" }));
      setShowForm(false);
      toast.success("Sent to Contact Leads");
    } catch (err) {
      toast.error("Could not send", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="pointer-events-auto flex h-[min(34rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0B1220]/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#00D2FF]/20 to-[#7B5CFF]/20 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">SR Help Agent</p>
              <p className="text-[11px] text-white/70">Product answers · contact form → Admin leads</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/15 p-1.5 text-white/80 hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-5 ${
                  m.role === "user"
                    ? "ml-auto bg-brand-primary text-white"
                    : "mr-auto border border-white/10 bg-white/5 text-white/90"
                }`}
              >
                {m.text}
              </div>
            ))}

            {!showForm ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {quick.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendText(q)}
                    className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowForm(true)}
                  className="rounded-full border border-brand-primary/40 bg-brand-primary/15 px-2.5 py-1 text-[11px] text-brand-primary"
                >
                  Contact form
                </button>
              </div>
            ) : (
              <form onSubmit={submitLead} className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs text-content-muted">
                  Submits to Admin → Contact Leads. Prefer email?{" "}
                  <a className="text-brand-primary hover:underline" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                </p>
                <input
                  className="w-full rounded-lg border border-white/10 bg-ink-elevated px-2.5 py-2 text-sm"
                  placeholder="Your name"
                  value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })}
                />
                <input
                  className="w-full rounded-lg border border-white/10 bg-ink-elevated px-2.5 py-2 text-sm"
                  placeholder="Email"
                  type="email"
                  value={lead.email}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                />
                <input
                  className="w-full rounded-lg border border-white/10 bg-ink-elevated px-2.5 py-2 text-sm"
                  placeholder="Phone (optional)"
                  value={lead.phone}
                  onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                />
                <input
                  className="w-full rounded-lg border border-white/10 bg-ink-elevated px-2.5 py-2 text-sm"
                  placeholder="Company (optional)"
                  value={lead.company}
                  onChange={(e) => setLead({ ...lead, company: e.target.value })}
                />
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-white/10 bg-ink-elevated px-2.5 py-2 text-sm"
                  placeholder="How can we help?"
                  value={lead.message}
                  onChange={(e) => setLead({ ...lead, message: e.target.value })}
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send to Contact Leads"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs"
                    onClick={() => setShowForm(false)}
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendText(input);
            }}
          >
            <input
              className="flex-1 rounded-xl border border-white/10 bg-ink-elevated px-3 py-2.5 text-sm text-white"
              placeholder="Ask about the app…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-brand-primary p-2.5 text-white disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 hover:brightness-110"
        aria-label={open ? "Close help chat" : "Open help chat"}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">{open ? "Close" : "Help"}</span>
      </button>
    </div>
  );
}
