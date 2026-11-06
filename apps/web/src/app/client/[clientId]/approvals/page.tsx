"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApprovalCard, type InboxItem } from "@/components/approval-card";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { useClientBrand } from "@/hooks/use-client-brand";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

export default function ClientApprovalsPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params.clientId;
  const brand = useClientBrand(clientId);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setItems(await apiFetch<InboxItem[]>(`/clients/${clientId}/approvals/inbox`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [clientId, router]);

  return (
    <AppShell
      title="Content for approval"
      subtitle={brand ? `Managed by ${brand.companyName}` : "Client workspace"}
      nav={clientNav(clientId)}
      brandLogoUrl={brand?.logoUrl}
      brandName={brand?.name}
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4">
        <StatCard label="Awaiting your decision" value={items.length} />
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <ApprovalCard key={item.id} item={item} onDone={load} />
        ))}
        {!items.length ? (
          <EmptyState
            title="Nothing waiting"
            body="When your agency submits content for approval, review it here. Approve, reject, or request changes — each decision is tied to a content revision."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
