"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { fileToBrandLogoDataUrl } from "@/lib/brand-logo";
import { useClientBrand } from "@/hooks/use-client-brand";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Workspace = {
  client: {
    name: string;
    industry: string | null;
    brandVoice: string | null;
    timezone: string;
    approvalWorkflow: string;
    companyId: string;
    companyName: string;
    logoUrl?: string | null;
    website?: string | null;
    businessName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
};

const WORKFLOWS = [
  "CLIENT_THEN_PUBLISH",
  "COMPANY_THEN_PUBLISH",
  "CLIENT_THEN_COMPANY",
  "CLIENT_THEN_AUTO_SCHEDULE",
] as const;

export default function ClientSettingsPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params.clientId;
  const brand = useClientBrand(clientId);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    brandVoice: "",
    timezone: "UTC",
    approvalWorkflow: "CLIENT_THEN_PUBLISH",
    website: "",
    businessName: "",
    contactEmail: "",
    contactPhone: "",
    logoUrl: "",
  });
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Workspace>(`/clients/${clientId}/workspace`)
      .then((w) => {
        setCompanyName(w.client.companyName);
        setForm({
          name: w.client.name,
          industry: w.client.industry ?? "",
          brandVoice: w.client.brandVoice ?? "",
          timezone: w.client.timezone,
          approvalWorkflow: w.client.approvalWorkflow,
          website: w.client.website ?? "",
          businessName: w.client.businessName ?? "",
          contactEmail: w.client.contactEmail ?? "",
          contactPhone: w.client.contactPhone ?? "",
          logoUrl: w.client.logoUrl ?? "",
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [clientId, router]);

  async function onLogo(file: File | null) {
    if (!file) return;
    try {
      const logoUrl = await fileToBrandLogoDataUrl(file, 512);
      setForm((f) => ({ ...f, logoUrl }));
      toast.success("Logo ready", "Recommended 512×512 applied — save to keep it.");
    } catch (err) {
      toast.error("Logo failed", err instanceof Error ? err.message : "Could not read image");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch(`/clients/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || null,
          brandVoice: form.brandVoice || null,
          timezone: form.timezone,
          approvalWorkflow: form.approvalWorkflow,
          website: form.website || null,
          businessName: form.businessName || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
          logoUrl: form.logoUrl || null,
        }),
      });
      setMessage("Profile updated.");
      toast.success("Saved", "Client profile details updated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      toast.error("Save failed", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Profile and settings"
      subtitle={companyName ? `Managed by ${companyName}` : "Client workspace"}
      nav={clientNav(clientId)}
      brandLogoUrl={form.logoUrl || brand?.logoUrl}
      brandName={form.name || brand?.name}
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}

      <form onSubmit={onSubmit} className="panel max-w-3xl space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="Brand logo" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-primary/20 text-lg font-bold">
              {(form.name || "C").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--text)]">Client brand logo</p>
            <p className="text-xs text-[var(--muted)]">
              Recommended size: 512×512 PNG or JPG. Shown in your client panel instead of the SR mark.
            </p>
            <label className="mt-2 inline-flex cursor-pointer text-xs font-semibold text-brand-primary">
              Upload / replace
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-content-muted">
            Organization name
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block text-xs text-content-muted">
            Industry
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Contact email
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Mobile
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              inputMode="numeric"
              maxLength={10}
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
            />
          </label>
          <label className="block text-xs text-content-muted">
            Website
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="block text-xs text-content-muted">
            Business name
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            />
          </label>
          <label className="block text-xs text-content-muted sm:col-span-2">
            About / brand voice
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              rows={3}
              value={form.brandVoice}
              onChange={(e) => setForm({ ...form, brandVoice: e.target.value })}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Timezone
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Approval workflow
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.approvalWorkflow}
              onChange={(e) => setForm({ ...form, approvalWorkflow: e.target.value })}
            >
              {WORKFLOWS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </AppShell>
  );
}
