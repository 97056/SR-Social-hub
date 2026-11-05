"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Job = {
  id: string;
  platformCode: string;
  status: string;
  attemptCount: number;
  contentRevision: number;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  lastError: string | null;
  post: { id: string; baseCaption: string; status: string; revision: number };
  socialAccount: {
    accountName: string | null;
    username: string | null;
    connectionMode: string;
  } | null;
  events: Array<{ id: string; type: string; message: string | null; createdAt: string }>;
};

export default function PublishingQueuePage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setJobs(await apiFetch<Job[]>(`/companies/${companyId}/publishing/jobs`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
    const t = setInterval(() => {
      load().catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [companyId, router]);

  async function retry(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/publishing/jobs/${id}/retry`, { method: "POST" });
      await apiFetch("/publishing/worker/tick", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/publishing/jobs/${id}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  }

  async function tick() {
    setBusy("tick");
    try {
      await apiFetch("/publishing/worker/tick", { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const counts = {
    queued: jobs.filter((j) => ["QUEUED", "SCHEDULED", "RETRY_PENDING"].includes(j.status)).length,
    publishing: jobs.filter((j) => j.status === "PUBLISHING").length,
    published: jobs.filter((j) => j.status === "PUBLISHED").length,
    failed: jobs.filter((j) =>
      ["FAILED", "REQUIRES_REAUTH", "ASSISTED_REQUIRED"].includes(j.status),
    ).length,
  };

  return (
    <AppShell title="Publishing queue" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          className="rounded-xl border border-white/15 px-3 py-2 text-sm"
          disabled={busy === "tick"}
          onClick={tick}
        >
          Run worker now
        </button>
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <StatCard label="Queued / scheduled" value={counts.queued} />
        <StatCard label="Publishing" value={counts.publishing} />
        <StatCard label="Published" value={counts.published} />
        <StatCard label="Failed / assisted" value={counts.failed} />
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-content-muted">
                  {job.platformCode} · rev {job.contentRevision}
                </p>
                <p className="mt-1 font-medium">
                  {job.post.baseCaption.slice(0, 120) || job.post.id}
                </p>
                <p className="mt-1 text-xs text-content-muted">
                  {job.socialAccount?.accountName ?? "No account"} ·{" "}
                  {job.socialAccount?.connectionMode ?? "n/a"}
                </p>
              </div>
              <span className="rounded-lg bg-white/5 px-2 py-1 text-xs">{job.status}</span>
            </div>
            {job.externalPostId ? (
              <p className="mt-2 text-xs text-brand-success">External ID: {job.externalPostId}</p>
            ) : null}
            {job.lastError ? (
              <p className="mt-2 text-xs text-brand-error">{job.lastError}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-white/10 px-2 py-1 text-xs"
                disabled={!!busy}
                onClick={() => retry(job.id)}
              >
                Retry
              </button>
              <button
                className="rounded-lg border border-brand-error/40 px-2 py-1 text-xs text-brand-error"
                disabled={!!busy}
                onClick={() => cancel(job.id)}
              >
                Cancel
              </button>
            </div>
            {job.events?.length ? (
              <ul className="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-content-muted">
                {job.events.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    {e.type}
                    {e.message ? ` — ${e.message}` : ""} ·{" "}
                    {new Date(e.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {!jobs.length ? (
          <EmptyState
            title="Queue is empty"
            body="Approved posts enqueue publish jobs automatically. Live results appear here once accounts are connected."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
