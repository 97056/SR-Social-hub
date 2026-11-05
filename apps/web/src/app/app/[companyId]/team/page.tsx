"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";
import { isEmail, requireFields } from "@/lib/validate";

type CommandCenter = {
  team: Array<{ role: string; email: string; fullName: string }>;
  pendingInvites: Array<{ id: string; email: string; expiresAt: string; companyRole?: string }>;
};

export default function CompanyTeamPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<CommandCenter | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setData(await apiFetch<CommandCenter>(`/companies/${companyId}/command-center`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!requireFields([{ label: "Email", value: email, ok: isEmail(email) }])) return;
    try {
      const res = await apiFetch<{ acceptPath: string }>(`/companies/${companyId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setInviteLink(`${window.location.origin}${res.acceptPath}`);
      setEmail("");
      toast.success("Invite sent", "Share the invite link with your teammate.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      setError(msg);
      toast.error("Invite failed", msg);
    }
  }

  return (
    <AppShell title="Team members" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {inviteLink ? (
        <p className="mb-4 rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 p-3 text-sm">
          Invite link (dev): {inviteLink}
        </p>
      ) : null}

      <form noValidate onSubmit={onInvite} className="panel mb-6 grid gap-3 p-5 md:grid-cols-3">
        <input
          className="field mt-0"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="MEMBER">Member</option>
          <option value="APPROVER">Approver</option>
        </select>
        <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white">
          Invite teammate
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Active members</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(data?.team ?? []).map((m) => (
              <li key={m.email} className="flex justify-between gap-3">
                <div>
                  <p className="font-medium">{m.fullName}</p>
                  <p className="text-content-muted">{m.email}</p>
                </div>
                <span className="text-xs text-content-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Pending invites</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(data?.pendingInvites ?? []).map((i) => (
              <li key={i.id}>
                <p className="font-medium">{i.email}</p>
                <p className="text-content-muted">
                  {i.companyRole ?? "CLIENT"} · expires {new Date(i.expiresAt).toLocaleString()}
                </p>
              </li>
            ))}
            {!data?.pendingInvites?.length ? (
              <li className="text-content-muted">No pending invites.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
