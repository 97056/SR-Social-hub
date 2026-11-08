"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigneeName?: string | null;
  dueDate?: string | null;
};

export default function GrowthTasksPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function load(cid = clientId) {
    const q = cid ? `?clientId=${cid}` : "";
    setTasks(await apiFetch<Task[]>(`/companies/${companyId}/growth/tasks${q}`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ clients: Array<{ id: string; name: string }> }>(`/companies/${companyId}/social-accounts`).then(
      (p) => {
        setClients(p.clients ?? []);
        setClientId(p.clients?.[0]?.id ?? "");
      },
    );
  }, [companyId, router]);

  useEffect(() => {
    if (!getToken()) return;
    load().catch((e: Error) => toast.error("Load failed", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, clientId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    try {
      await apiFetch(`/companies/${companyId}/growth/tasks`, {
        method: "POST",
        body: JSON.stringify({ clientId, title, description }),
      });
      setTitle("");
      setDescription("");
      toast.success("Task created");
      await load();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : "Error");
    }
  }

  async function setStatus(id: string, status: string) {
    await apiFetch(`/companies/${companyId}/growth/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <AppShell title="Tasks & Execution" subtitle="AI Growth Center" nav={companyNav(companyId)}>
      <div className="mb-4 max-w-sm">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
      </div>
      <form onSubmit={onCreate} className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
        <label className="block text-xs text-content-muted md:col-span-2">
          Task title
          <input className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block text-xs text-content-muted md:col-span-2">
          Description
          <textarea className="mt-1 min-h-[80px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">Add task</button>
      </form>
      <div className="space-y-3">
        {tasks.length ? (
          tasks.map((t) => (
            <GrowthCard key={t.id} title={t.title} action={<><StatusPill value={t.priority} /><StatusPill value={t.status} /></>}>
              <p className="text-sm text-content-muted">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"].map((s) => (
                  <button key={s} onClick={() => setStatus(t.id, s)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-content-muted">
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </GrowthCard>
          ))
        ) : (
          <EmptyState text="No tasks yet. Approve an opportunity or create one manually." />
        )}
      </div>
    </AppShell>
  );
}
