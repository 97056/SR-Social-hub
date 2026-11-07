"use client";

import { useState } from "react";
import { AuthImage } from "@/components/auth-image";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { apiFetch } from "@/lib/api";

export type InboxItem = {
  id: string;
  revision: number;
  step: string;
  createdAt: string;
  post: {
    id: string;
    baseCaption: string;
    baseHashtags?: string;
    status: string;
    revision: number;
    mediaAsset?: { id: string; kind: string } | null;
    client: { id: string; name: string; approvalWorkflow: string };
    variants: Array<{ platformCode: string; caption: string; title?: string | null; hashtags?: string }>;
    targets: Array<{ platformCode: string }>;
  };
};

export function ApprovalCard({
  item,
  onDone,
}: {
  item: InboxItem;
  onDone: () => void;
}) {
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  async function decide(decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<{ id: string; status: string; scheduledAt?: string | null }>(
        `/approvals/${item.id}/decide`,
        {
          method: "POST",
          body: JSON.stringify({ decision, comments: comments || undefined }),
        },
      );
      if (updated.status === "APPROVED" || updated.status === "SCHEDULED") {
        try {
          await apiFetch(`/posts/${updated.id}/publish`, { method: "POST" });
          await apiFetch("/publishing/worker/tick", { method: "POST" });
        } catch {
          // Queue UI can retry publish if enqueue fails.
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  const platforms: Array<{
    platformCode: string;
    caption: string;
    title?: string | null;
    hashtags?: string;
  }> =
    item.post.variants.length > 0
      ? item.post.variants
      : item.post.targets.map((t) => ({
          platformCode: t.platformCode,
          caption: item.post.baseCaption,
          title: null,
          hashtags: item.post.baseHashtags,
        }));

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-content-muted">
            {item.step} approval · rev {item.revision}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">{item.post.client.name}</h3>
          <p className="mt-1 text-xs text-content-muted">{item.post.client.approvalWorkflow}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Hide preview" : "Preview all networks"}
          </button>
          <span className="rounded-lg bg-brand-warning/15 px-2 py-1 text-xs text-brand-warning">
            {item.post.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[140px_1fr]">
        {item.post.mediaAsset?.kind === "IMAGE" ? (
          <AuthImage
            assetId={item.post.mediaAsset.id}
            alt="Post media"
            className="h-32 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-32 place-items-center rounded-xl bg-ink-elevated text-xs text-content-muted">
            {item.post.mediaAsset?.kind ?? "No media"}
          </div>
        )}
        <div>
          <p className="whitespace-pre-wrap text-sm">{item.post.baseCaption || "—"}</p>
          {item.post.baseHashtags ? (
            <p className="mt-2 text-xs text-brand-primary">{item.post.baseHashtags}</p>
          ) : null}
        </div>
      </div>

      {previewOpen ? (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-muted">
            Customer preview by network
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {platforms.map((v) => (
              <div
                key={v.platformCode}
                className="rounded-2xl border border-white/10 bg-[var(--elevated)] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <SocialPlatformIcon code={v.platformCode} className="h-5 w-5" />
                  <span className="text-sm font-semibold">{v.platformCode}</span>
                </div>
                {item.post.mediaAsset?.kind === "IMAGE" ? (
                  <AuthImage
                    assetId={item.post.mediaAsset.id}
                    alt=""
                    className="mb-3 h-36 w-full rounded-xl object-cover"
                  />
                ) : null}
                {v.title ? <p className="mb-1 text-sm font-semibold">{v.title}</p> : null}
                <p className="whitespace-pre-wrap text-sm leading-6">{v.caption || item.post.baseCaption}</p>
                {v.hashtags || item.post.baseHashtags ? (
                  <p className="mt-2 text-xs text-brand-primary">
                    {v.hashtags || item.post.baseHashtags}
                  </p>
                ) : null}
              </div>
            ))}
            {!platforms.length ? (
              <p className="text-xs text-content-muted">No platform targets on this post.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <textarea
        className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
        placeholder="Comments / reason (optional — shown if you reject or request changes)"
        rows={2}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />

      {error ? <p className="text-sm text-brand-error">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          className="rounded-xl bg-brand-success/90 px-4 py-2 text-sm font-semibold text-ink-bg disabled:opacity-50"
          onClick={() => decide("APPROVED")}
        >
          Approve
        </button>
        <button
          disabled={busy}
          className="rounded-xl border border-brand-warning/40 px-4 py-2 text-sm text-brand-warning disabled:opacity-50"
          onClick={() => decide("CHANGES_REQUESTED")}
        >
          Request changes
        </button>
        <button
          disabled={busy}
          className="rounded-xl border border-brand-error/40 px-4 py-2 text-sm text-brand-error disabled:opacity-50"
          onClick={() => decide("REJECTED")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
