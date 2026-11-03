"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, EmptyState } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setItems(await apiFetch<Notification[]>("/notifications"));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [router]);

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    await load();
  }

  async function markAll() {
    await apiFetch("/notifications/read-all", { method: "POST" });
    await load();
  }

  return (
    <AppShell title="Notifications" subtitle="In-app activity" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4">
        <button
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold"
          onClick={() => markAll()}
        >
          Mark all read
        </button>
      </div>
      {!items.length ? (
        <EmptyState title="No notifications" body="Approval and publishing events will appear here." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`panel p-4 ${n.readAt ? "opacity-70" : "border-brand-primary/30"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-content-muted">{n.type}</p>
                  <h3 className="font-display text-lg font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-content-muted">{n.body}</p>
                  <p className="mt-2 text-xs text-content-muted">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {n.href ? (
                    <button
                      className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => router.push(n.href!)}
                    >
                      Open
                    </button>
                  ) : null}
                  {!n.readAt ? (
                    <button
                      className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold"
                      onClick={() => markRead(n.id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
