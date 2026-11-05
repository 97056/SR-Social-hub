"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { isEmail, requireFields } from "@/lib/validate";

export function ContactForm({ supportEmail }: { supportEmail: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !requireFields([
        { label: "Name", value: name, ok: name.trim().length >= 2 },
        { label: "Email", value: email, ok: isEmail(email) },
        { label: "Message", value: message, ok: message.trim().length >= 5 },
      ])
    ) {
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify({ name, email, phone, company, message }),
      });
      setName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setMessage("");
      toast.success(
        "Message sent",
        phone
          ? "Thanks! Our team received your note and can call you directly from admin."
          : "Thanks! Our team received your message and will reply soon.",
      );
    } catch (err) {
      toast.error("Could not send", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-contact relative overflow-hidden rounded-[1.75rem] border border-white/10 px-6 py-10 sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute inset-0 landing-how-mesh" aria-hidden />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-secondary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl" />

      <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
            Let&apos;s talk
          </p>
          <h2 className="landing-heading font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tell us what you need. We&apos;ll call back.
          </h2>
          <p className="mt-4 text-base leading-7 text-content-muted">
            Share onboarding, custom quota, or walkthrough details. Your message lands in the admin
            inbox — with a direct call option when you add a phone number.
          </p>
          <div className="mt-6 space-y-3 text-sm text-content-muted">
            <p>
              Email:{" "}
              <a className="text-brand-primary hover:underline" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
            </p>
            <Link href="/support" className="inline-flex text-brand-primary hover:underline">
              Browse FAQs / Support center →
            </Link>
          </div>
        </div>

        <form
          noValidate
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[0_0_40px_rgba(0,210,255,0.08)] backdrop-blur sm:p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-content-muted">
              Name *
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Email *
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Phone (for direct call)
              <input
                className="field"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Company
              <input
                className="field"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Agency / brand"
              />
            </label>
          </div>
          <label className="block text-xs text-content-muted">
            Message *
            <textarea
              className="field min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What should we help with?"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="landing-cta w-full px-5 py-3 text-sm font-semibold sm:w-auto"
          >
            {loading ? "Sending…" : "Submit message"}
          </button>
        </form>
      </div>
    </div>
  );
}
