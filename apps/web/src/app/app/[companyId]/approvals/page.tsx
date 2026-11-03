"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApprovalCard, type InboxItem } from "@/components/approval-card";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

export default function CompanyApprovalsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setItems(await apiFetch<InboxItem[]>(`/companies/${companyId}/approvals/inbox`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  return (
    <AppShell title="Approval inbox" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Waiting on company" value={items.length} />
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <ApprovalCard key={item.id} item={item} onDone={load} />
        ))}
        {!items.length ? (
          <EmptyState
            title="No company approvals pending"
            body="Posts that require a company approval step will appear here after client approval (or immediately for company-only workflows)."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
