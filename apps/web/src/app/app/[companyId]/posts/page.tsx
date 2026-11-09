"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { AppShell } from "@/components/shell";
import { AuthImage } from "@/components/auth-image";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { isoToLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/datetime-local";
import { companyNav } from "@/lib/nav";

const swalDark = Swal.mixin({
  background: "#0B1220",
  color: "#E8EEF9",
  confirmButtonColor: "#E11D48",
  cancelButtonColor: "#334155",
  customClass: {
    popup: "rounded-2xl border border-white/10 shadow-2xl",
    confirmButton: "rounded-xl px-4 py-2 font-semibold",
    cancelButton: "rounded-xl px-4 py-2 font-semibold",
  },
});

type Post = {
  id: string;
  status: string;
  baseCaption: string;
  baseHashtags?: string | null;
  scheduledAt?: string | null;
  updatedAt: string;
  createdAt?: string;
  client: { id: string; name: string };
  mediaAsset?: { id: string; kind: string; originalName?: string } | null;
  variants?: Array<{
    platformCode: string;
    caption: string;
    title?: string | null;
    hashtags?: string | null;
  }>;
  targets: Array<{
    platformCode: string;
    status?: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    externalPostId?: string | null;
    lastError?: string | null;
  }>;
};

function formatWhen(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function previewAspect(platform: string) {
  const p = platform.toUpperCase();
  if (p === "PINTEREST") return "aspect-[2/3]";
  if (p === "YOUTUBE") return "aspect-video";
  if (p === "LINKEDIN" || p === "FACEBOOK" || p === "X") return "aspect-[1.91/1]";
  return "aspect-square";
}

function inRange(iso: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
}

function platformsFor(p: Post) {
  if (p.variants?.length) return p.variants;
  return p.targets.map((t) => ({
    platformCode: t.platformCode,
    caption: p.baseCaption,
    title: null as string | null,
    hashtags: p.baseHashtags ?? null,
  }));
}

export default function PostsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [posts, setPosts] = useState<Post[]>([]);
  const [clientFilter, setClientFilter] = useState("ALL");
  const [view, setView] = useState<"list" | "grid">("grid");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<string>("");
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [schedulePost, setSchedulePost] = useState<Post | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState("");

  async function load() {
    setPosts(await apiFetch<Post[]>(`/companies/${companyId}/posts`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) map.set(p.client.id, p.client.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [posts]);

  const visible = useMemo(() => {
    return posts.filter((p) => {
      if (clientFilter !== "ALL" && p.client.id !== clientFilter) return false;
      const published = p.targets.find((t) => t.publishedAt)?.publishedAt;
      const anchor = published || p.scheduledAt || p.updatedAt || p.createdAt;
      return inRange(anchor, from, to);
    });
  }, [posts, clientFilter, from, to]);

  function openPreview(p: Post) {
    const plats = platformsFor(p);
    setPreviewPost(p);
    setPreviewPlatform(plats[0]?.platformCode || p.targets[0]?.platformCode || "");
  }

  function openEdit(p: Post) {
    setEditPost(p);
    setEditCaption(p.baseCaption || "");
    setEditHashtags(p.baseHashtags || "");
  }

  function openSchedule(p: Post) {
    setSchedulePost(p);
    setScheduleLocal(isoToLocalDateTimeInput(p.scheduledAt));
  }

  async function publishNow(postId: string) {
    setBusy(postId);
    setError(null);
    try {
      await apiFetch(`/posts/${postId}/publish`, { method: "POST", body: "{}" });
      toast.success("Publishing", "Post queued to connected networks");
      await load();
      router.push(`/app/${companyId}/publishing`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      setError(message);
      toast.error("Publish failed", message);
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editPost) return;
    setBusy(editPost.id);
    try {
      await apiFetch(`/posts/${editPost.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          baseCaption: editCaption,
          baseHashtags: editHashtags,
        }),
      });
      toast.success("Post updated", "Caption saved across platform variants");
      setEditPost(null);
      await load();
    } catch (err) {
      toast.error("Edit failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function saveSchedule(e: FormEvent) {
    e.preventDefault();
    if (!schedulePost) return;
    const iso = localDateTimeInputToIso(scheduleLocal);
    if (!iso) {
      toast.error("Pick a schedule time");
      return;
    }
    setBusy(schedulePost.id);
    try {
      const updated = await apiFetch<Post>(`/posts/${schedulePost.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt: iso }),
      });
      toast.success(
        "Rescheduled",
        `Will publish at ${new Date(updated.scheduledAt || iso).toLocaleString()}`,
      );
      setSchedulePost(null);
      await load();
    } catch (err) {
      toast.error("Reschedule failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function deletePost(p: Post) {
    const platforms = Array.from(
      new Set(p.targets.map((t) => t.platformCode).filter(Boolean)),
    );
    const platformList =
      platforms.length > 0
        ? platforms.map((code) => `<li><strong>${code}</strong></li>`).join("")
        : "<li><em>No connected targets</em></li>";

    const confirm = await swalDark.fire({
      icon: "warning",
      title: "Delete this post?",
      html: `
        <p style="margin:0 0 12px;text-align:left;font-size:14px;line-height:1.5;opacity:.92">
          Remove from <strong>SR Social Hub</strong> and delete on
          <strong>all linked social media</strong> for
          <strong>${p.client.name}</strong> where supported.
        </p>
        <p style="margin:0 0 6px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.12em;opacity:.65">
          Networks
        </p>
        <ul style="margin:0;padding-left:18px;text-align:left;font-size:14px;line-height:1.7">
          ${platformList}
        </ul>
        <p style="margin:14px 0 0;text-align:left;font-size:12px;opacity:.7;line-height:1.45">
          Queued jobs are cancelled. Live Meta posts are removed when possible;
          other networks may need a manual delete if already published.
        </p>
      `,
      showCancelButton: true,
      focusCancel: true,
      confirmButtonText: "Yes, delete everywhere",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    setBusy(p.id);
    swalDark.fire({
      title: "Deleting…",
      html: "Removing from SR Social Hub and connected networks.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await apiFetch<{
        ok: boolean;
        remoteResults?: Array<{ platform: string; ok: boolean; detail: string }>;
      }>(`/posts/${p.id}`, { method: "DELETE" });
      const results = res.remoteResults || [];
      const resultsHtml =
        results.length > 0
          ? `<ul style="margin:8px 0 0;padding-left:18px;text-align:left;font-size:13px;line-height:1.7">${results
              .map(
                (r) =>
                  `<li><strong>${r.platform}</strong>: ${
                    r.ok ? "Deleted / cleared" : r.detail
                  }</li>`,
              )
              .join("")}</ul>`
          : `<p style="margin:8px 0 0;text-align:left;font-size:13px;opacity:.85">Removed from workspace.</p>`;

      await swalDark.fire({
        icon: "success",
        title: "Post deleted",
        html: `
          <p style="margin:0;text-align:left;font-size:14px;line-height:1.5">
            Cleared from SR Social Hub and attempted delete on all linked social media.
          </p>
          ${resultsHtml}
        `,
        confirmButtonText: "Done",
        confirmButtonColor: "#14B8A6",
      });

      if (previewPost?.id === p.id) setPreviewPost(null);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      await swalDark.fire({
        icon: "error",
        title: "Delete failed",
        text: message,
        confirmButtonText: "Close",
      });
      toast.error("Delete failed", message);
    } finally {
      setBusy(null);
    }
  }

  const previewPlatforms = previewPost ? platformsFor(previewPost) : [];
  const activePreview =
    previewPlatforms.find((v) => v.platformCode === previewPlatform) || previewPlatforms[0];

  return (
    <AppShell title="Posts" subtitle="Client-wise publishing history" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <button className="btn-primary" onClick={() => router.push(`/app/${companyId}/create`)}>
          Create post
        </button>
        <button className="btn-ghost" onClick={() => router.push(`/app/${companyId}/publishing`)}>
          Publishing queue
        </button>
        <label className="text-xs text-content-muted">
          Client
          <select
            className="mt-1 block min-w-[160px] rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="ALL">All clients</option>
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-content-muted">
          From
          <input
            type="date"
            className="mt-1 block rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-content-muted">
          To
          <input
            type="date"
            className="mt-1 block rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="ml-auto flex rounded-xl border border-white/10 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 ${view === "list" ? "bg-white/10" : "text-content-muted"}`}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 ${view === "grid" ? "bg-white/10" : "text-content-muted"}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
        </div>
      </div>

      <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
        {visible.map((p) => (
          <article key={p.id} className="panel overflow-hidden p-0">
            <div className={`flex gap-3 p-4 ${view === "grid" ? "flex-col" : "items-start"}`}>
              <button type="button" className="block w-full text-left" onClick={() => openPreview(p)}>
                <div
                  className={`shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 ${
                    view === "grid" ? "w-full" : "w-24"
                  }`}
                >
                  {p.mediaAsset?.kind === "IMAGE" ? (
                    <AuthImage
                      assetId={p.mediaAsset.id}
                      alt={p.mediaAsset.originalName ?? "Post"}
                      className="aspect-square w-full object-contain"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center text-[10px] text-content-muted">
                      {p.mediaAsset?.kind ?? "No img"}
                    </div>
                  )}
                </div>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                    {p.client.name}
                  </p>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 line-clamp-3 text-sm font-medium">{p.baseCaption || "—"}</p>
                <p className="mt-2 text-xs text-content-muted">
                  Updated {formatWhen(p.updatedAt)}
                  {p.scheduledAt ? ` · Scheduled ${formatWhen(p.scheduledAt)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.targets.slice(0, 8).map((t) => (
                    <SocialPlatformIcon
                      key={`${p.id}-${t.platformCode}`}
                      code={t.platformCode}
                      className="h-4 w-4"
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold"
                    onClick={() => openPreview(p)}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold"
                    onClick={() => openEdit(p)}
                    disabled={busy === p.id || p.status === "PUBLISHED" || p.status === "PUBLISHING"}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold"
                    onClick={() => openSchedule(p)}
                    disabled={busy === p.id || p.status === "PUBLISHED" || p.status === "PUBLISHING"}
                  >
                    Schedule
                  </button>
                  {["APPROVED", "FAILED", "SCHEDULED"].includes(p.status) ? (
                    <button
                      type="button"
                      className="rounded-lg bg-brand-primary px-2.5 py-1 text-[11px] font-semibold text-[#050814] disabled:opacity-50"
                      disabled={busy === p.id}
                      onClick={() => publishNow(p.id)}
                    >
                      {busy === p.id ? "…" : "Publish now"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-brand-error/40 px-2.5 py-1 text-[11px] font-semibold text-brand-error"
                    disabled={busy === p.id}
                    onClick={() => deletePost(p)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!visible.length ? (
          <div className="panel p-6 text-sm text-content-muted sm:col-span-full">
            No posts for this filter / date range.
          </div>
        ) : null}
      </div>

      {previewPost && activePreview ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0B1220] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-content-muted">Preview</p>
                <h3 className="font-display text-lg font-semibold">{previewPost.client.name}</h3>
              </div>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-2 py-1 text-xs"
                onClick={() => setPreviewPost(null)}
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {previewPlatforms.map((v) => (
                <button
                  key={v.platformCode}
                  type="button"
                  onClick={() => setPreviewPlatform(v.platformCode)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                    previewPlatform === v.platformCode
                      ? "border-brand-primary bg-brand-primary/20 text-white"
                      : "border-white/15 text-content-muted"
                  }`}
                >
                  <SocialPlatformIcon code={v.platformCode} className="h-3.5 w-3.5" />
                  {v.platformCode}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--elevated)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <SocialPlatformIcon code={activePreview.platformCode} className="h-5 w-5" />
                <span className="text-sm font-semibold">{activePreview.platformCode}</span>
              </div>
              {previewPost.mediaAsset?.kind === "IMAGE" ? (
                <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <AuthImage
                    assetId={previewPost.mediaAsset.id}
                    alt=""
                    className={`w-full object-contain ${previewAspect(activePreview.platformCode)}`}
                  />
                </div>
              ) : null}
              {activePreview.title ? (
                <p className="mb-1 text-sm font-semibold">{activePreview.title}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-6">
                {activePreview.caption || previewPost.baseCaption}
              </p>
              {activePreview.hashtags || previewPost.baseHashtags ? (
                <p className="mt-2 text-xs text-brand-primary">
                  {activePreview.hashtags || previewPost.baseHashtags}
                </p>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] text-content-muted">
              Tap a network below the title to switch previews for every selected platform.
            </p>
          </div>
        </div>
      ) : null}

      {editPost ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg space-y-3 rounded-2xl border border-white/15 bg-[#0B1220] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-content-muted">Edit post</p>
                <h3 className="font-display text-lg font-semibold">{editPost.client.name}</h3>
              </div>
              <button type="button" className="rounded-lg border border-white/15 px-2 py-1 text-xs" onClick={() => setEditPost(null)}>
                Close
              </button>
            </div>
            <textarea
              className="min-h-32 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Caption"
              required
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
              value={editHashtags}
              onChange={(e) => setEditHashtags(e.target.value)}
              placeholder="Hashtags"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === editPost.id}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === editPost.id ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="rounded-xl border border-white/15 px-4 py-2 text-sm" onClick={() => setEditPost(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {schedulePost ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveSchedule}
            className="w-full max-w-md space-y-3 rounded-2xl border border-white/15 bg-[#0B1220] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-content-muted">Change schedule</p>
                <h3 className="font-display text-lg font-semibold">{schedulePost.client.name}</h3>
              </div>
              <button type="button" className="rounded-lg border border-white/15 px-2 py-1 text-xs" onClick={() => setSchedulePost(null)}>
                Close
              </button>
            </div>
            <label className="block text-xs text-content-muted">
              Publish at (your local time)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                required
              />
            </label>
            {scheduleLocal ? (
              <p className="text-[11px] text-content-muted">
                Will publish around {new Date(scheduleLocal).toLocaleString()}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === schedulePost.id}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === schedulePost.id ? "Saving…" : "Update schedule"}
              </button>
              <button type="button" className="rounded-xl border border-white/15 px-4 py-2 text-sm" onClick={() => setSchedulePost(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
