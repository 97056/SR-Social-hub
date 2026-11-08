"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Task = { id: string; title: string; description?: string | null; status: string; priority: string };

export default function ClientTasksPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);

  async function load() {
    setTasks(await apiFetch<Task[]>(`/clients/${clientId}/growth/tasks`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => toast.error("Load failed", e.message));
  }, [clientId, router]);

  async function setStatus(id: string, status: string) {
    await apiFetch(`/clients/${clientId}/growth/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <AppShell title="My Tasks" subtitle="Growth execution" nav={clientNav(clientId)}>
      <div className="space-y-3">
        {tasks.length ? tasks.map((t) => (
          <GrowthCard key={t.id} title={t.title} action={<><StatusPill value={t.priority} /><StatusPill value={t.status} /></>}>
            <p className="text-sm text-content-muted">{t.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["TODO", "IN_PROGRESS", "DONE"].map((s) => (
                <button key={s} onClick={() => setStatus(t.id, s)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-content-muted">
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </GrowthCard>
        )) : <EmptyState text="No tasks assigned." />}
      </div>
    </AppShell>
  );
}
