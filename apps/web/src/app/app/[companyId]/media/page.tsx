"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthImage } from "@/components/auth-image";
import { AppShell, StatCard } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Client = { id: string; name: string };
type MediaAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  folder: string;
  tags: string[];
  createdAt: string;
};

export default function MediaLibraryPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadClients() {
    const ws = await apiFetch<{ clients: Client[] }>(`/companies/${companyId}/workspace`);
    setClients(ws.clients);
    if (!clientId && ws.clients[0]) setClientId(ws.clients[0].id);
  }

  async function loadMedia(id = clientId) {
    if (!id) return;
    const list = await apiFetch<MediaAsset[]>(
      `/companies/${companyId}/clients/${id}/media${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    );
    setAssets(list);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    loadClients().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  useEffect(() => {
    if (clientId) loadMedia(clientId).catch((e: Error) => setError(e.message));
  }, [clientId]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) return;
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    if (!fileInput.files?.[0]) {
      toast.error("No file selected", "Choose an image or video to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", fileInput.files[0]);
      await apiFetch(`/companies/${companyId}/clients/${clientId}/media`, {
        method: "POST",
        body,
      });
      form.reset();
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/media/${id}`, { method: "DELETE" });
    await loadMedia();
  }

  return (
    <AppShell title="Media library" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Assets" value={assets.length} />
        <StatCard label="Images" value={assets.filter((a) => a.kind === "IMAGE").length} />
        <StatCard label="Videos" value={assets.filter((a) => a.kind === "VIDEO").length} />
      </div>

      <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-4">
        <select
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm md:col-span-2"
          placeholder="Search name or tag"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadMedia().catch(() => undefined);
          }}
        />
        <button
          className="rounded-xl border border-white/15 px-3 py-2 text-sm"
          onClick={() => loadMedia()}
        >
          Search
        </button>
      </div>

      <form noValidate onSubmit={onUpload} className="panel mb-6 flex flex-wrap items-center gap-3 p-5">
        <input name="file" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" />
        <button
          disabled={uploading || !clientId}
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload media"}
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {assets.map((asset) => (
          <div key={asset.id} className="panel overflow-hidden">
            {asset.kind === "IMAGE" ? (
              <AuthImage assetId={asset.id} alt={asset.originalName} className="h-40 w-full object-cover" />
            ) : (
              <div className="grid h-40 place-items-center bg-ink-elevated text-sm text-content-muted">
                {asset.kind}
              </div>
            )}
            <div className="space-y-2 p-3 text-sm">
              <p className="truncate font-medium">{asset.originalName}</p>
              <p className="text-xs text-content-muted">
                {(asset.sizeBytes / 1024).toFixed(1)} KB · {asset.folder}
              </p>
              <div className="flex gap-2">
                <button
                  className="text-xs text-brand-secondary"
                  onClick={() =>
                    router.push(`/app/${companyId}/create?clientId=${clientId}&mediaId=${asset.id}`)
                  }
                >
                  Use in post
                </button>
                <button className="text-xs text-brand-error" onClick={() => remove(asset.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
