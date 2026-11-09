"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AuthImage } from "@/components/auth-image";
import { AppShell } from "@/components/shell";
import { SocialPlatformIcon, PLATFORM_BRAND_COLOR } from "@/components/social-platform-icon";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { localDateTimeInputToIso } from "@/lib/datetime-local";
import { companyNav } from "@/lib/nav";

type Client = { id: string; name: string; logoUrl?: string | null };
type MediaAsset = {
  id: string;
  originalName: string;
  kind: string;
  createdAt?: string;
  updatedAt?: string;
};
type SocialCard = {
  platform: { code: string; name: string; connectable: boolean };
  accounts: Array<{ id: string; accountName: string | null; status: string }>;
};
type Variant = {
  platformCode: string;
  caption: string;
  title?: string;
  description?: string;
  hashtags: string;
};
type Post = {
  id: string;
  status: string;
  baseCaption: string;
  baseHashtags: string;
  callToAction?: string | null;
  linkUrl?: string | null;
  mediaAssetId?: string | null;
  scheduledAt?: string | null;
  variants: Variant[];
  targets: Array<{ platformCode: string; socialAccountId?: string | null }>;
  mediaAsset?: MediaAsset | null;
  client: { id: string; name: string };
};
type Validation = {
  ok: boolean;
  errors: Array<{ code: string; message: string; platform?: string }>;
  warnings: Array<{ code: string; message: string; platform?: string }>;
};
type PlatformRule = {
  captionMax: number;
  titleMax?: number;
  descriptionMax?: number;
  requiresTitle?: boolean;
  notes: string;
};
type Rules = Record<string, PlatformRule>;

const STEPS = ["Client", "Media", "Content", "Platforms", "Variants", "Validate", "Submit"];

/** Soft ceilings (e.g. Facebook ~63k) — show count, but don't red-warn until actually over. */
function isHardCaptionLimit(max: number | undefined) {
  return typeof max === "number" && max > 0 && max <= 5000;
}

function CharMeter({
  label,
  value,
  max,
  hard,
}: {
  label: string;
  value: string;
  max?: number;
  hard?: boolean;
}) {
  if (!max || max <= 0) return null;
  const len = value.length;
  const over = len > max;
  const warn = hard && len > Math.floor(max * 0.9) && !over;
  const show = hard || over || len > 0;
  if (!show) return null;
  return (
    <p
      className={`text-xs ${
        over ? "font-semibold text-brand-error" : warn ? "text-amber-300" : "text-content-muted"
      }`}
    >
      {label}: {len.toLocaleString("en-IN")}
      {hard || over ? ` / ${max.toLocaleString("en-IN")}` : max > 5000 ? " (no short limit)" : ""}
      {over ? " — over limit, shorten before submit" : ""}
    </p>
  );
}

function CreatePostInner() {
  const params = useParams<{ companyId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const companyId = params.companyId;

  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [clientId, setClientId] = useState(search.get("clientId") ?? "");
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [mediaQuery, setMediaQuery] = useState("");
  const [social, setSocial] = useState<SocialCard[]>([]);
  const [rules, setRules] = useState<Rules>({});
  const [post, setPost] = useState<Post | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaId, setMediaId] = useState(search.get("mediaId") ?? "");
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [scheduledAt, setScheduledAt] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      apiFetch<{ clients: Client[] }>(`/companies/${companyId}/workspace`),
      apiFetch<Rules>("/composer/platform-rules"),
    ])
      .then(([ws, r]) => {
        setClients(ws.clients);
        setRules(r);
      })
      .catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      apiFetch<MediaAsset[]>(`/companies/${companyId}/clients/${clientId}/media`),
      apiFetch<SocialCard[]>(`/clients/${clientId}/social-accounts`),
    ])
      .then(([m, s]) => {
        setMedia(m);
        setSocial(s);
        const connected = s
          .filter((x) => x.accounts.some((a) => a.status === "CONNECTED"))
          .map((x) => x.platform.code);
        setSelectedPlatforms((prev) => (prev.length ? prev : connected));
        const map: Record<string, string> = {};
        for (const card of s) {
          const acc = card.accounts.find((a) => a.status === "CONNECTED") ?? card.accounts[0];
          if (acc) map[card.platform.code] = acc.id;
        }
        setAccountMap((prev) => ({ ...map, ...prev }));
      })
      .catch((e: Error) => setError(e.message));
  }, [clientId, companyId]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, clientQuery]);

  const filteredMedia = useMemo(() => {
    const q = mediaQuery.trim().toLowerCase();
    if (!q) return media;
    return media.filter((m) => m.originalName.toLowerCase().includes(q));
  }, [media, mediaQuery]);

  const activeVariantPlatforms = useMemo(
    () => selectedPlatforms.filter((p) => variants[p]),
    [selectedPlatforms, variants],
  );

  const selectedMedia = media.find((m) => m.id === mediaId);

  async function ensureDraft() {
    if (post) return post;
    const created = await apiFetch<Post>(`/companies/${companyId}/posts`, {
      method: "POST",
      body: JSON.stringify({
        clientId,
        mediaAssetId: mediaId || undefined,
        baseCaption: caption,
        baseHashtags: hashtags,
        callToAction: cta || undefined,
        linkUrl: linkUrl || undefined,
      }),
    });
    setPost(created);
    return created;
  }

  async function saveContentAndPlatforms() {
    const draft = await ensureDraft();
    const nextVariants = selectedPlatforms.map((platformCode) => {
      const existing = variants[platformCode];
      return (
        existing ?? {
          platformCode,
          caption,
          hashtags,
          title: ["YOUTUBE", "PINTEREST"].includes(platformCode) ? caption.slice(0, 100) : "",
          description: caption,
        }
      );
    });
    const map: Record<string, Variant> = {};
    for (const v of nextVariants) map[v.platformCode] = v;
    setVariants(map);

    const updated = await apiFetch<Post>(`/posts/${draft.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        mediaAssetId: mediaId || null,
        baseCaption: caption,
        baseHashtags: hashtags,
        callToAction: cta || null,
        linkUrl: linkUrl || null,
        scheduledAt: localDateTimeInputToIso(scheduledAt),
        variants: nextVariants,
        targets: selectedPlatforms.map((platformCode) => ({
          platformCode,
          socialAccountId: accountMap[platformCode] || undefined,
        })),
      }),
    });
    setPost(updated);
    return updated;
  }

  async function runValidate() {
    setBusy(true);
    setError(null);
    try {
      const updated = await saveContentAndPlatforms();
      const result = await apiFetch<Validation>(`/posts/${updated.id}/validate`);
      setValidation(result);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(
    action: "PENDING_APPROVAL" | "SCHEDULED" | "PUBLISH_NOW",
    skipApproval = false,
  ) {
    if (!post && !(await ensureDraft())) return;
    const current = post ?? (await ensureDraft());
    setBusy(true);
    setError(null);
    try {
      await saveContentAndPlatforms();
      const scheduleIso = localDateTimeInputToIso(scheduledAt) || undefined;
      const result = await apiFetch<{ post: Post; validation: Validation }>(
        `/posts/${current.id}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            scheduledAt: scheduleIso,
            skipApproval,
          }),
        },
      );
      setPost(result.post);
      setValidation(result.validation);
      if (action === "PUBLISH_NOW" && skipApproval) {
        try {
          await apiFetch(`/posts/${result.post.id}/publish`, { method: "POST", body: "{}" });
          await apiFetch("/publishing/worker/tick", { method: "POST" });
          toast.success("Publishing", "Queued to all selected networks");
          router.push(`/app/${companyId}/publishing`);
          return;
        } catch (err) {
          toast.error(
            "Queued for approval path",
            err instanceof Error ? err.message : "Open Publishing queue to retry",
          );
        }
      }
      if (action === "PENDING_APPROVAL") {
        toast.success("Sent for approval", "Client will review in Approvals");
        router.push(`/app/${companyId}/posts`);
        return;
      }
      if (action === "SCHEDULED") {
        const when = result.post.scheduledAt
          ? new Date(result.post.scheduledAt).toLocaleString()
          : scheduleIso
            ? new Date(scheduleIso).toLocaleString()
            : "selected time";
        toast.success(
          skipApproval ? "Scheduled" : "Scheduled pending approval",
          skipApproval
            ? `Will publish at ${when} (your local time)`
            : `Client must approve before publish · ${when}`,
        );
        router.push(`/app/${companyId}/posts`);
        return;
      }
      setStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  function togglePlatform(code: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code],
    );
  }

  return (
    <AppShell title="Create post" subtitle="Content studio" nav={companyNav(companyId)} tone="#F0C14A">
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, idx) => (
          <button
            key={label}
            className={`rounded-full px-3 py-1.5 text-xs ${
              idx === step
                ? "bg-brand-primary text-white"
                : idx < step
                  ? "bg-brand-primary/20 text-white"
                  : "bg-white/5 text-content-muted"
            }`}
            onClick={() => setStep(idx)}
          >
            {idx + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="panel space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Select client</h2>
          <input
            className="field max-w-md"
            placeholder="Search clients…"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${
                  clientId === c.id
                    ? "border-brand-primary bg-brand-primary/10"
                    : "border-[var(--border)] bg-[var(--elevated)]"
                }`}
                onClick={() => {
                  setClientId(c.id);
                  setPost(null);
                  setSelectedPlatforms([]);
                }}
              >
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-primary/20 font-bold">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold">{c.name}</span>
              </button>
            ))}
          </div>
          <button
            className="btn-primary disabled:opacity-50"
            onClick={() => setStep(1)}
            disabled={!clientId}
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="panel space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Select media</h2>
          <input
            className="field max-w-md"
            placeholder="Search media by name…"
            value={mediaQuery}
            onChange={(e) => setMediaQuery(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              className={`rounded-xl border p-4 text-left text-sm ${
                !mediaId ? "border-brand-primary bg-brand-primary/10" : "border-white/10"
              }`}
              onClick={() => setMediaId("")}
            >
              No media
            </button>
            {filteredMedia.map((m) => (
              <button
                key={m.id}
                className={`overflow-hidden rounded-xl border text-left ${
                  mediaId === m.id ? "border-brand-primary" : "border-white/10"
                }`}
                onClick={() => setMediaId(m.id)}
              >
                {m.kind === "IMAGE" ? (
                  <AuthImage assetId={m.id} alt={m.originalName} className="h-28 w-full object-cover" />
                ) : (
                  <div className="grid h-28 place-items-center bg-ink-elevated text-xs text-content-muted">
                    {m.kind}
                  </div>
                )}
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{m.originalName}</p>
                  <p className="mt-1 text-[10px] text-content-muted">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel max-w-2xl space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Base content</h2>
          {selectedMedia?.kind === "IMAGE" ? (
            <AuthImage
              assetId={selectedMedia.id}
              alt={selectedMedia.originalName}
              className="h-44 w-full rounded-2xl object-cover"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["caption", "Draft caption"],
                ["hashtags", "Suggest hashtags"],
                ["cta", "Suggest CTA"],
                ["ideas", "Campaign ideas"],
              ] as const
            ).map(([feature, label]) => (
              <button
                key={feature}
                type="button"
                className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const res = await apiFetch<{ text: string }>(`/companies/${companyId}/ai/generate`, {
                      method: "POST",
                      body: JSON.stringify({
                        feature,
                        prompt: caption || "Write a social post",
                        clientId: clientId || undefined,
                        tone: "professional",
                      }),
                    });
                    if (feature === "caption" || feature === "ideas") setCaption(res.text);
                    if (feature === "hashtags") setHashtags(res.text);
                    if (feature === "cta") setCta(res.text);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "AI failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-32 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            placeholder="Caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            placeholder="Hashtags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            placeholder="Call to action"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            placeholder="Link URL"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={async () => {
              setBusy(true);
              try {
                await ensureDraft();
                setStep(3);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Select platforms</h2>
            <button
              type="button"
              className="text-xs font-semibold text-brand-primary"
              onClick={() => {
                const all = social
                  .filter((s) => s.accounts.some((a) => a.status === "CONNECTED"))
                  .map((s) => s.platform.code);
                setSelectedPlatforms(all);
              }}
            >
              Select all connected
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {social.map(({ platform, accounts }) => {
              const color = PLATFORM_BRAND_COLOR[platform.code] ?? "#7B5CFF";
              const on = selectedPlatforms.includes(platform.code);
              return (
                <label
                  key={platform.code}
                  className="rounded-2xl border p-4 text-sm"
                  style={{
                    borderColor: on ? color : undefined,
                    background: on ? `${color}18` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <SocialPlatformIcon code={platform.code} className="h-6 w-6" />
                      {platform.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => togglePlatform(platform.code)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-content-muted">{rules[platform.code]?.notes}</p>
                  {accounts.length ? (
                    <select
                      className="mt-3 w-full rounded-lg border border-white/10 bg-ink-elevated px-2 py-1.5 text-xs"
                      value={accountMap[platform.code] ?? accounts[0]?.id ?? ""}
                      onChange={(e) =>
                        setAccountMap((m) => ({ ...m, [platform.code]: e.target.value }))
                      }
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.accountName ?? a.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-brand-warning">No connected account</p>
                  )}
                </label>
              );
            })}
          </div>
          <button
            className="btn-primary disabled:opacity-50"
            disabled={!selectedPlatforms.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await saveContentAndPlatforms();
                setStep(4);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Customize variants
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="panel p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              Selected platforms preview
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedPlatforms.map((code) => (
                <div
                  key={code}
                  className="flex max-w-xs items-start gap-2 rounded-xl border border-white/10 bg-[var(--elevated)] p-2 text-xs"
                >
                  <SocialPlatformIcon code={code} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="line-clamp-3">{variants[code]?.caption || caption || "—"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-white/15 px-3 py-2 text-xs"
              onClick={async () => {
                if (!post) return;
                const updated = await apiFetch<Post>(`/posts/${post.id}/apply-base`, {
                  method: "POST",
                  body: JSON.stringify({ platforms: selectedPlatforms }),
                });
                const map: Record<string, Variant> = {};
                for (const v of updated.variants) map[v.platformCode] = v;
                setVariants(map);
                setPost(updated);
              }}
            >
              Copy base caption to all
            </button>
          </div>
          {activeVariantPlatforms.map((code) => {
            const rule = rules[code];
            const captionVal = variants[code]?.caption ?? "";
            const titleVal = variants[code]?.title ?? "";
            const descVal = variants[code]?.description ?? captionVal;
            const captionHard = isHardCaptionLimit(rule?.captionMax);
            const captionOver = Boolean(rule?.captionMax && captionVal.length > rule.captionMax);
            const titleOver = Boolean(rule?.titleMax && titleVal.length > rule.titleMax);
            const descOver = Boolean(rule?.descriptionMax && descVal.length > rule.descriptionMax);
            return (
              <div
                key={code}
                className={`panel space-y-2 p-5 ${
                  captionOver || titleOver || descOver ? "ring-1 ring-brand-error/50" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-display font-semibold">
                    <SocialPlatformIcon code={code} className="h-5 w-5" />
                    {code}
                  </h3>
                  {rule?.notes ? (
                    <p className="text-[11px] text-content-muted">{rule.notes}</p>
                  ) : null}
                </div>
                {(code === "YOUTUBE" || code === "PINTEREST") && (
                  <>
                    <input
                      className={`w-full rounded-xl border bg-ink-elevated px-3 py-2 text-sm ${
                        titleOver ? "border-brand-error" : "border-white/10"
                      }`}
                      placeholder={`Title${rule?.titleMax ? ` (max ${rule.titleMax})` : ""}`}
                      value={titleVal}
                      onChange={(e) =>
                        setVariants((v) => ({
                          ...v,
                          [code]: { ...v[code], platformCode: code, title: e.target.value },
                        }))
                      }
                    />
                    <CharMeter label="Title" value={titleVal} max={rule?.titleMax} hard />
                  </>
                )}
                <textarea
                  className={`min-h-24 w-full rounded-xl border bg-ink-elevated px-3 py-2 text-sm ${
                    captionOver ? "border-brand-error" : "border-white/10"
                  }`}
                  placeholder={
                    captionHard && rule?.captionMax
                      ? `Caption (max ${rule.captionMax})`
                      : "Caption"
                  }
                  value={captionVal}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVariants((v) => ({
                      ...v,
                      [code]: {
                        ...v[code],
                        platformCode: code,
                        caption: next,
                        // Keep pin/YouTube description aligned with caption unless separately edited later.
                        description: next,
                        hashtags: v[code]?.hashtags ?? "",
                      },
                    }));
                  }}
                />
                <CharMeter
                  label="Caption"
                  value={captionVal}
                  max={rule?.captionMax}
                  hard={captionHard}
                />
                {rule?.descriptionMax && (code === "YOUTUBE" || code === "PINTEREST") ? (
                  <CharMeter label="Description" value={descVal} max={rule.descriptionMax} hard />
                ) : null}
              </div>
            );
          })}
          <button className="btn-primary" disabled={busy} onClick={runValidate}>
            Validate
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="panel max-w-2xl space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Validation</h2>
          {validation?.ok ? (
            <p className="text-sm text-brand-success">Ready — no blocking errors.</p>
          ) : (
            <ul className="space-y-2 text-sm text-brand-error">
              {(validation?.errors ?? []).map((e, i) => (
                <li key={i}>
                  {e.platform ? `${e.platform}: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          <button className="btn-primary" onClick={() => setStep(6)}>
            Continue to submit
          </button>
        </div>
      )}

      {step === 6 && (
        <div className="panel max-w-xl space-y-5 p-5">
          <h2 className="font-display text-lg font-semibold">Submit</h2>
          <button
            disabled={busy}
            className="btn-primary w-full disabled:opacity-50"
            onClick={() => submit("PENDING_APPROVAL")}
          >
            Send to client for approval
          </button>

          <div className="rounded-2xl border border-white/10 bg-[var(--elevated)] p-4 space-y-3">
            <p className="text-sm font-semibold">Direct schedule / publish</p>
            <label className="block text-xs text-content-muted">
              Schedule time (your local timezone)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
            {scheduledAt ? (
              <p className="text-[11px] text-content-muted">
                Will send as {new Date(scheduledAt).toLocaleString()} · stored in UTC for publishing
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <button
                disabled={busy || !scheduledAt}
                className="rounded-xl border border-brand-secondary/40 px-4 py-2 text-sm text-brand-secondary disabled:opacity-50"
                onClick={() => submit("SCHEDULED", false)}
              >
                Schedule with approval
              </button>
              <button
                disabled={busy || !scheduledAt}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => submit("SCHEDULED", true)}
              >
                Schedule without approval
              </button>
              <button
                disabled={busy}
                className="rounded-xl bg-[#3DDC97] px-4 py-2 text-sm font-semibold text-[#050814] disabled:opacity-50"
                onClick={() => submit("PUBLISH_NOW", true)}
              >
                Push now (all selected networks)
              </button>
            </div>
          </div>

          {post ? (
            <p className="text-sm text-content-muted">
              Post {post.id} · status <span className="text-white">{post.status}</span>
            </p>
          ) : null}
          <button
            className="text-sm text-brand-secondary"
            onClick={() => router.push(`/app/${companyId}/posts`)}
          >
            View posts →
          </button>
        </div>
      )}
    </AppShell>
  );
}

export default function CreatePostPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}>
      <CreatePostInner />
    </Suspense>
  );
}
