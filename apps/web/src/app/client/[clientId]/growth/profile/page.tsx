"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

const FIELDS = [
  "businessName",
  "websiteUrl",
  "industry",
  "category",
  "description",
  "productsServices",
  "targetAudience",
  "location",
  "serviceAreas",
  "goals",
  "competitors",
  "uniqueSellingPoints",
  "challenges",
  "monthlyBudgetRange",
] as const;

export default function ClientGrowthProfilePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ profile: Record<string, string | null> }>(`/clients/${clientId}/growth/profile`).then((p) => {
      const next: Record<string, string> = {};
      for (const key of FIELDS) next[key] = String(p.profile?.[key] ?? "");
      setForm(next);
    });
  }, [clientId, router]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/clients/${clientId}/growth/profile`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, confirm: true }),
      });
      toast.success("Profile saved");
    } catch (err) {
      toast.error("Save failed", err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell title="Business Profile" subtitle="AI Growth Center" nav={clientNav(clientId)}>
      <form onSubmit={onSave} className="panel grid max-w-3xl gap-3 p-5 md:grid-cols-2">
        {FIELDS.map((key) => (
          <label key={key} className={`block text-xs text-content-muted ${["description", "productsServices", "competitors", "challenges", "goals"].includes(key) ? "md:col-span-2" : ""}`}>
            {key}
            {["description", "productsServices", "competitors", "challenges", "goals", "uniqueSellingPoints", "targetAudience", "serviceAreas"].includes(key) ? (
              <textarea className="mt-1 min-h-[80px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            ) : (
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            )}
          </label>
        ))}
        <button className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white md:col-span-2">Save & confirm</button>
      </form>
    </AppShell>
  );
}
