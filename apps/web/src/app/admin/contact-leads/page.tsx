"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
};

function telHref(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export default function AdminContactLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLeads(await apiFetch<Lead[]>("/admin/contact-leads"));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [router]);

  async function setStatus(id: string, status: Lead["status"]) {
    setError(null);
    try {
      await apiFetch(`/admin/contact-leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <AppShell title="Contact leads" subtitle="Let's Talk inbox" nav={adminNav()}>
      <p className="mb-5 max-w-3xl text-sm leading-6 text-content-muted">
        Messages from the landing <span className="text-brand-primary">Let&apos;s Talk</span> form.
        Use <span className="text-brand-primary">Direct call</span> when a phone number was provided.
      </p>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      {!leads.length ? (
        <div className="panel p-6 text-sm text-content-muted">No contact messages yet.</div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => {
            const call = telHref(lead.phone);
            return (
              <article key={lead.id} className="panel space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-white">{lead.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-content-muted">
                      {new Date(lead.createdAt).toLocaleString()} · {lead.status}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      lead.status === "NEW"
                        ? "border-brand-primary/40 text-brand-primary"
                        : lead.status === "CONTACTED"
                          ? "border-brand-secondary/40 text-brand-secondary"
                          : "border-white/20 text-content-muted"
                    }`}
                  >
                    {lead.status}
                  </span>
                </div>

                <div className="grid gap-2 text-sm text-content-muted sm:grid-cols-2">
                  <p>
                    Email:{" "}
                    <a className="text-brand-primary hover:underline" href={`mailto:${lead.email}`}>
                      {lead.email}
                    </a>
                  </p>
                  <p>
                    Phone:{" "}
                    {lead.phone ? (
                      <span className="text-white">{lead.phone}</span>
                    ) : (
                      <span>Not provided</span>
                    )}
                  </p>
                  <p className="sm:col-span-2">
                    Company: <span className="text-white">{lead.company || "—"}</span>
                  </p>
                </div>

                <p className="rounded-xl border border-white/10 bg-ink-elevated/60 px-4 py-3 text-sm leading-6 text-content">
                  {lead.message}
                </p>

                <div className="flex flex-wrap gap-2">
                  {call ? (
                    <a href={call} className="btn-primary inline-flex items-center gap-2">
                      Direct call
                    </a>
                  ) : (
                    <span className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-content-muted">
                      No phone for call
                    </span>
                  )}
                  <a href={`mailto:${lead.email}`} className="btn-ghost">
                    Email
                  </a>
                  {lead.status !== "CONTACTED" ? (
                    <button type="button" className="btn-ghost" onClick={() => setStatus(lead.id, "CONTACTED")}>
                      Mark contacted
                    </button>
                  ) : null}
                  {lead.status !== "CLOSED" ? (
                    <button type="button" className="btn-ghost" onClick={() => setStatus(lead.id, "CLOSED")}>
                      Close
                    </button>
                  ) : (
                    <button type="button" className="btn-ghost" onClick={() => setStatus(lead.id, "NEW")}>
                      Reopen
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
