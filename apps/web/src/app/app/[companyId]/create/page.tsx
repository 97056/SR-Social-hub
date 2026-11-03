"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AuthImage } from "@/components/auth-image";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Client = { id: string; name: string };
type MediaAsset = { id: string; originalName: string; kind: string };
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
type Rules = Record<string, { captionMax: number; requiresTitle?: boolean; notes: string }>;

const STEPS = ["Client", "Media", "Content", "Platforms", "Variants", "Validate", "Submit"];

function CreatePostInner() {
  const params = useParams<{ companyId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const companyId = params.companyId;

  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(search.get("clientId") ?? "");
  const [media, setMedia] = useState<MediaAsset[]>([]);
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
        if (!clientId && ws.clients[0]) setClientId(ws.clients[0].id);
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
      })
      .catch((e: Error) => setError(e.message));
  }, [clientId, companyId]);

  const activeVariantPlatforms = useMemo(
    () => selectedPlatforms.filter((p) => variants[p]),
    [selectedPlatforms, variants],
  );

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
        scheduledAt: scheduledAt || null,
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

  async function submit(action: "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED") {
    if (!post) return;
    setBusy(true);
    setError(null);
    try {
      await saveContentAndPlatforms();
      const result = await apiFetch<{ post: Post; validation: Validation }>(`/posts/${post.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          action,
          scheduledAt: scheduledAt || undefined,
        }),
      });
      setPost(result.post);
      setValidation(result.validation);
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
    <AppShell title="Create post" subtitle="Content studio" nav={companyNav(companyId)}>
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
        <div className="panel max-w-xl space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Select client</h2>
          <select
            className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPost(null);
              setSelectedPlatforms([]);
            }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={() => setStep(1)}
            disabled={!clientId}
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-display text-lg font-semibold">Select media</h2>
            <p className="mt-1 text-sm text-content-muted">Optional for some platforms; required for Instagram.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                className={`rounded-xl border p-4 text-left text-sm ${
                  !mediaId ? "border-brand-primary bg-brand-primary/10" : "border-white/10"
                }`}
                onClick={() => setMediaId("")}
              >
                No media
              </button>
              {media.map((m) => (
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
                  <p className="truncate p-2 text-xs">{m.originalName}</p>
                </button>
              ))}
            </div>
            <button
              className="mt-4 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel max-w-2xl space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Base content</h2>
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
                    const res = await apiFetch<{
                      text: string;
                      disclaimer: string;
                    }>(`/companies/${companyId}/ai/generate`, {
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
          <p className="text-xs text-content-muted">
            AI drafts are editable. They do not guarantee engagement or conversions.
          </p>
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
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
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
          <h2 className="font-display text-lg font-semibold">Select platforms</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {social.map(({ platform, accounts }) => (
              <label
                key={platform.code}
                className={`rounded-xl border p-4 text-sm ${
                  selectedPlatforms.includes(platform.code)
                    ? "border-brand-primary bg-brand-primary/10"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{platform.name}</span>
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform.code)}
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
            ))}
          </div>
          <button
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!selectedPlatforms.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                for (const code of selectedPlatforms) {
                  if (social.find((s) => s.platform.code === code)?.accounts[0] && !accountMap[code]) {
                    setAccountMap((m) => ({
                      ...m,
                      [code]: social.find((s) => s.platform.code === code)!.accounts[0].id,
                    }));
                  }
                }
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
          {activeVariantPlatforms.map((code) => (
            <div key={code} className="panel space-y-2 p-5">
              <h3 className="font-display font-semibold">{code}</h3>
              <p className="text-xs text-content-muted">
                Max {rules[code]?.captionMax ?? "—"} chars · approx. preview only
              </p>
              {(code === "YOUTUBE" || code === "PINTEREST") && (
                <input
                  className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
                  placeholder="Title"
                  value={variants[code]?.title ?? ""}
                  onChange={(e) =>
                    setVariants((v) => ({
                      ...v,
                      [code]: { ...v[code], platformCode: code, title: e.target.value },
                    }))
                  }
                />
              )}
              <textarea
                className="min-h-24 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
                value={variants[code]?.caption ?? ""}
                onChange={(e) =>
                  setVariants((v) => ({
                    ...v,
                    [code]: {
                      ...v[code],
                      platformCode: code,
                      caption: e.target.value,
                      hashtags: v[code]?.hashtags ?? "",
                    },
                  }))
                }
              />
              <div className="rounded-xl border border-dashed border-white/15 bg-ink-elevated/50 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-content-muted">Preview (approx.)</p>
                <p className="mt-2 whitespace-pre-wrap">{variants[code]?.caption}</p>
              </div>
            </div>
          ))}
          <button
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
            disabled={busy}
            onClick={runValidate}
          >
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
          {(validation?.warnings ?? []).length > 0 && (
            <ul className="space-y-2 text-sm text-brand-warning">
              {validation!.warnings.map((w, i) => (
                <li key={i}>
                  {w.platform ? `${w.platform}: ` : ""}
                  {w.message}
                </li>
              ))}
            </ul>
          )}
          <label className="block text-xs text-content-muted">
            Schedule (optional)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <button
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={() => setStep(6)}
          >
            Continue to submit
          </button>
        </div>
      )}

      {step === 6 && (
        <div className="panel max-w-xl space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Save or submit</h2>
          <p className="text-sm text-content-muted">
            Direct publish is deferred to the publishing engine. Approvals and schedules are persisted now.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm"
              onClick={() => submit("DRAFT")}
            >
              Save draft
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={() => submit("PENDING_APPROVAL")}
            >
              Submit for approval
            </button>
            <button
              disabled={busy || !scheduledAt}
              className="rounded-xl border border-brand-secondary/40 px-4 py-2 text-sm text-brand-secondary disabled:opacity-50"
              onClick={() => submit("SCHEDULED")}
            >
              Schedule
            </button>
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
