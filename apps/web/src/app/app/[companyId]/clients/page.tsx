"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { fileToBrandLogoDataUrl } from "@/lib/brand-logo";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";
import { fieldErrorClass, isEmail, isIndianMobile } from "@/lib/validate";

type SocialLink = {
  id: string;
  platformCode: string;
  accountName: string | null;
  username: string | null;
  status: string;
};

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  approvalWorkflow: string;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  logoUrl?: string | null;
  postCount?: number;
  memberCount?: number;
  socials?: SocialLink[];
};

type Workspace = {
  clients: ClientRow[];
};

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  FACEBOOK: { label: "FB", color: "#1877F2" },
  INSTAGRAM: { label: "IG", color: "#E1306C" },
  LINKEDIN: { label: "IN", color: "#0A66C2" },
  X: { label: "X", color: "#8B98A5" },
  YOUTUBE: { label: "YT", color: "#FF0000" },
  PINTEREST: { label: "PI", color: "#E60023" },
  THREADS: { label: "TH", color: "#A8A8A8" },
};

const emptyForm = {
  contactName: "",
  organizationName: "",
  email: "",
  mobile: "",
  description: "",
  website: "",
  businessName: "",
  noWebsite: false,
  logoUrl: "" as string,
};

export default function CompanyClientsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [logoBusyId, setLogoBusyId] = useState<string | null>(null);

  async function load() {
    setData(await apiFetch<Workspace>(`/companies/${companyId}/workspace`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data?.clients ?? [];
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contactEmail ?? "").toLowerCase().includes(q) ||
        (c.contactPhone ?? "").includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q),
    );
  }, [data?.clients, query]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const contactName = form.contactName.trim();
    const organizationName = form.organizationName.trim();
    const email = form.email.trim();
    const mobile = form.mobile.trim();
    const description = form.description.trim();
    const website = form.noWebsite ? "" : form.website.trim();
    const businessName = form.noWebsite ? form.businessName.trim() : "";

    const nextErrors: Record<string, boolean> = {
      contactName: !contactName,
      organizationName: !organizationName,
      email: !email || !isEmail(email),
      mobile: !mobile || !isIndianMobile(mobile),
      description: !description,
      website: !form.noWebsite && !website,
      businessName: form.noWebsite && !businessName,
    };
    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      if (!contactName || !organizationName || !email || !mobile || !description) {
        toast.error("Missing details", "Fill every required field — highlighted in red.");
      } else if (nextErrors.email) {
        toast.error("Invalid email", "Enter a valid email address.");
      } else if (nextErrors.mobile) {
        toast.error("Invalid mobile", "Enter a 10-digit Indian mobile starting with 6–9.");
      } else if (nextErrors.website) {
        toast.error("Website required", "Enter the website link, or turn on No website.");
      } else if (nextErrors.businessName) {
        toast.error("Business name required", "Enter the business name when there is no website.");
      }
      return;
    }

    setSaving(true);
    try {
      const created = await apiFetch<{ mailSent?: boolean; message?: string }>(
        `/companies/${companyId}/clients`,
        {
          method: "POST",
          body: JSON.stringify({
            contactName,
            organizationName,
            email,
            mobile,
            description,
            website: website || undefined,
            businessName: businessName || undefined,
            logoUrl: form.logoUrl || undefined,
          }),
        },
      );
      setForm(emptyForm);
      setFieldErrors({});
      setModalOpen(false);
      await load();
      if (created.mailSent === false) {
        toast.warning("Client added — email pending", created.message);
      } else {
        toast.success(
          "Client added",
          created.message || "Login credentials were emailed to the client.",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create failed";
      setError(msg);
      toast.error("Could not add client", msg);
    } finally {
      setSaving(false);
    }
  }

  async function onLogoFile(file: File | null, clientId?: string) {
    if (!file) return;
    try {
      const logoUrl = await fileToBrandLogoDataUrl(file, 512);
      if (clientId) {
        setLogoBusyId(clientId);
        await apiFetch(`/clients/${clientId}`, {
          method: "PATCH",
          body: JSON.stringify({ logoUrl }),
        });
        await load();
        toast.success("Brand logo saved", "Recommended size 512×512 applied.");
      } else {
        setForm((f) => ({ ...f, logoUrl }));
      }
    } catch (err) {
      toast.error("Logo upload failed", err instanceof Error ? err.message : "Could not read image");
    } finally {
      setLogoBusyId(null);
    }
  }

  return (
    <AppShell title="Clients" subtitle="Company workspace" nav={companyNav(companyId)} tone="#7B5CFF">
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {data?.clients.length ?? 0} client{(data?.clients.length ?? 0) === 1 ? "" : "s"} in this
            workspace
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field mt-0 min-w-[180px] flex-1 sm:max-w-xs"
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                view === "list" ? "bg-brand-primary text-[#050814]" : "text-[var(--muted)]"
              }`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                view === "grid" ? "bg-brand-primary text-[#050814]" : "text-[var(--muted)]"
              }`}
              onClick={() => setView("grid")}
            >
              Grid
            </button>
          </div>
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            Add client
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Socials</th>
                <th className="px-4 py-3 font-semibold">Approval</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ClientLogoMark name={c.name} logoUrl={c.logoUrl} />
                      <div>
                        <p className="font-medium text-[var(--text)]">{c.name}</p>
                        <p className="text-xs text-[var(--muted)]">{c.industry || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    <p>{c.contactEmail || "—"}</p>
                    <p className="text-xs">{c.contactPhone || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <SocialChips socials={c.socials} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">{c.approvalWorkflow}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer text-xs font-semibold text-[var(--muted)] hover:text-brand-primary">
                        {logoBusyId === c.id ? "Saving…" : "Brand logo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={logoBusyId === c.id}
                          onChange={(e) => onLogoFile(e.target.files?.[0] ?? null, c.id)}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-primary"
                        onClick={() => router.push(`/client/${c.id}/dashboard`)}
                      >
                        Open workspace
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!clients.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                    No clients yet. Click Add client to create one and email login credentials.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <article
              key={c.id}
              className="panel flex flex-col p-5 transition hover:-translate-y-0.5"
              style={{
                background:
                  "linear-gradient(165deg, color-mix(in srgb, #7B5CFF 12%, var(--card)), var(--card) 48%)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <ClientLogoMark name={c.name} logoUrl={c.logoUrl} className="mb-3" />
                  <h3 className="font-display text-lg font-semibold text-[var(--text)]">{c.name}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">{c.industry || "Organization"}</p>
                </div>
                <span className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {c.socials?.length ?? 0} socials
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Email</dt>
                  <dd className="truncate font-medium text-[var(--text)]">{c.contactEmail || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Mobile</dt>
                  <dd className="font-medium text-[var(--text)]">{c.contactPhone || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Members</dt>
                  <dd className="font-medium text-[var(--text)]">{c.memberCount ?? "—"}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <SocialChips socials={c.socials} />
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <label className="btn-ghost cursor-pointer text-center text-xs">
                  {logoBusyId === c.id ? "Saving logo…" : c.logoUrl ? "Replace brand logo" : "Add brand logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={logoBusyId === c.id}
                    onChange={(e) => onLogoFile(e.target.files?.[0] ?? null, c.id)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => router.push(`/client/${c.id}/dashboard`)}
                >
                  Open workspace
                </button>
              </div>
            </article>
          ))}
          {!clients.length ? (
            <div className="panel col-span-full px-4 py-12 text-center text-sm text-[var(--muted)]">
              No clients yet. Click Add client to create one and email login credentials.
            </div>
          ) : null}
        </div>
      )}

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-client-title"
          onClick={() => !saving && setModalOpen(false)}
        >
          <form
            noValidate
            onSubmit={onCreate}
            className="panel w-full max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="add-client-title" className="font-display text-xl font-semibold text-[var(--text)]">
                  Add client
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  All fields are required. Login credentials are emailed automatically.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid max-h-[min(70vh,36rem)] gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="field-label">Contact name</span>
                <input
                  className={`field ${fieldErrorClass(fieldErrors.contactName)}`}
                  value={form.contactName}
                  onChange={(e) => {
                    setForm({ ...form, contactName: e.target.value });
                    setFieldErrors((p) => ({ ...p, contactName: false }));
                  }}
                  placeholder="e.g. Priya Sharma"
                  autoComplete="name"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="field-label">Organization name</span>
                <input
                  className={`field ${fieldErrorClass(fieldErrors.organizationName)}`}
                  value={form.organizationName}
                  onChange={(e) => {
                    setForm({ ...form, organizationName: e.target.value });
                    setFieldErrors((p) => ({ ...p, organizationName: false }));
                  }}
                  placeholder="e.g. Acme Retail"
                  autoComplete="organization"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="field-label">Email</span>
                <input
                  className={`field ${fieldErrorClass(fieldErrors.email)}`}
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setFieldErrors((p) => ({ ...p, email: false }));
                  }}
                  placeholder="client@company.com"
                  autoComplete="email"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="field-label">Mobile</span>
                <input
                  className={`field ${fieldErrorClass(fieldErrors.mobile)}`}
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) => {
                    setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) });
                    setFieldErrors((p) => ({ ...p, mobile: false }));
                  }}
                  placeholder="9876543210"
                  autoComplete="tel"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="field-label">About the organization</span>
                <textarea
                  className={`field min-h-[88px] resize-y ${fieldErrorClass(fieldErrors.description)}`}
                  value={form.description}
                  onChange={(e) => {
                    setForm({ ...form, description: e.target.value });
                    setFieldErrors((p) => ({ ...p, description: false }));
                  }}
                  placeholder="What they do, industry, audience, tone…"
                  rows={3}
                />
              </label>

              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">No website</p>
                  <p className="text-xs text-[var(--muted)]">
                    Turn on if the client has no site — we will ask for business name instead.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.noWebsite}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    form.noWebsite ? "bg-brand-primary" : "bg-[var(--border)]"
                  }`}
                  onClick={() =>
                    setForm({
                      ...form,
                      noWebsite: !form.noWebsite,
                      website: !form.noWebsite ? "" : form.website,
                      businessName: form.noWebsite ? "" : form.businessName,
                    })
                  }
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      form.noWebsite ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {!form.noWebsite ? (
                <label className="block sm:col-span-2">
                  <span className="field-label">Website link</span>
                  <input
                    className={`field ${fieldErrorClass(fieldErrors.website)}`}
                    type="url"
                    value={form.website}
                    onChange={(e) => {
                      setForm({ ...form, website: e.target.value });
                      setFieldErrors((p) => ({ ...p, website: false }));
                    }}
                    placeholder="https://example.com"
                    autoComplete="url"
                  />
                </label>
              ) : (
                <label className="block sm:col-span-2">
                  <span className="field-label">Business name</span>
                  <input
                    className={`field ${fieldErrorClass(fieldErrors.businessName)}`}
                    value={form.businessName}
                    onChange={(e) => {
                      setForm({ ...form, businessName: e.target.value });
                      setFieldErrors((p) => ({ ...p, businessName: false }));
                    }}
                    placeholder="Public business / trade name"
                    autoComplete="organization"
                  />
                </label>
              )}

              <div className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <ClientLogoMark name={form.organizationName || "C"} logoUrl={form.logoUrl || null} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text)]">Client brand logo</p>
                    <p className="text-xs text-[var(--muted)]">
                      Recommended size: 512×512 PNG or JPG (square). We auto-crop to that size.
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer text-xs font-semibold text-brand-primary">
                      {form.logoUrl ? "Replace logo" : "Upload logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {form.logoUrl ? (
                      <button
                        type="button"
                        className="ml-3 text-xs text-[var(--muted)] hover:text-brand-error"
                        onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Creating…" : "Create & email login"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}

function ClientLogoMark({
  name,
  logoUrl,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`h-11 w-11 rounded-xl object-cover ring-1 ring-white/10 ${className}`}
      />
    );
  }
  return (
    <span
      className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white ${className}`}
      style={{ background: "#7B5CFF" }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SocialChips({ socials }: { socials?: SocialLink[] }) {
  if (!socials?.length) {
    return <span className="text-xs text-[var(--muted)]">No socials</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {socials.map((s) => {
        const meta = PLATFORM_META[s.platformCode] ?? { label: s.platformCode.slice(0, 2), color: "#9AA3B8" };
        return (
          <span
            key={s.id}
            className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ background: meta.color, opacity: s.status === "CONNECTED" ? 1 : 0.6 }}
            title={s.accountName || s.username || meta.label}
          >
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
