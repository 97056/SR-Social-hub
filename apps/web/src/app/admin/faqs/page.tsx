"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  published: boolean;
  sortOrder: number;
};

function newId() {
  return `faq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AdminFaqsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<FaqItem[]>("/admin/faqs")
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [router]);

  function patch(id: string, patch: Partial<FaqItem>) {
    setItems((all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addFaq() {
    setItems((all) => [
      ...all,
      {
        id: newId(),
        question: "",
        answer: "",
        published: true,
        sortOrder: all.length + 1,
      },
    ]);
  }

  function removeFaq(id: string) {
    setItems((all) => all.filter((f) => f.id !== id).map((f, i) => ({ ...f, sortOrder: i + 1 })));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await apiFetch<FaqItem[]>("/admin/faqs", {
        method: "PATCH",
        body: JSON.stringify({
          items: items.map((f, i) => ({
            ...f,
            question: f.question.trim(),
            answer: f.answer.trim(),
            sortOrder: i + 1,
          })),
        }),
      });
      setItems(saved);
      setMessage("FAQs saved. Published items appear on /support.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Support FAQs" subtitle="Super Admin" nav={adminNav()}>
      <p className="mb-5 max-w-3xl text-sm leading-6 text-content-muted">
        Add questions and answers shown on the public Support page. Toggle{" "}
        <span className="text-brand-primary">Published</span> to hide an item without deleting it.
      </p>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        {items.map((faq, index) => (
          <div key={faq.id} className="panel space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
                FAQ {index + 1}
              </p>
              <div className="flex items-center gap-4 text-xs text-content-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={faq.published}
                    onChange={(e) => patch(faq.id, { published: e.target.checked })}
                  />
                  Published
                </label>
                <button
                  type="button"
                  className="text-brand-error hover:underline"
                  onClick={() => removeFaq(faq.id)}
                >
                  Remove
                </button>
              </div>
            </div>
            <label className="block text-xs text-content-muted">
              Question
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={faq.question}
                onChange={(e) => patch(faq.id, { question: e.target.value })}
              />
            </label>
            <label className="block text-xs text-content-muted">
              Answer
              <textarea
                className="mt-1 min-h-[96px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={faq.answer}
                onChange={(e) => patch(faq.id, { answer: e.target.value })}
              />
            </label>
          </div>
        ))}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-ghost" onClick={addFaq}>
            Add FAQ
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save FAQs"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
