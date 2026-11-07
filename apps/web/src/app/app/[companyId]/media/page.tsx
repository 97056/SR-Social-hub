"use client";

import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthImage } from "@/components/auth-image";
import { AppShell, StatCard } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Client = { id: string; name: string; logoUrl?: string | null };
type MediaAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  folder: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
};

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function MediaLibraryPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function uploadFiles(files: FileList | File[]) {
    if (!clientId) {
      toast.error("Select a client", "Choose which client owns this media.");
      return;
    }
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        await apiFetch(`/companies/${companyId}/clients/${clientId}/media`, {
          method: "POST",
          body,
        });
      }
      toast.success("Uploaded", `${list.length} file${list.length === 1 ? "" : "s"} added`);
      await loadMedia();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast.error("Upload failed", msg);
    } finally {
      setUploading(false);
    }
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    if (!fileInput.files?.length) {
      toast.error("No file selected", "Choose an image or video to upload.");
      return;
    }
    await uploadFiles(fileInput.files);
    e.currentTarget.reset();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/media/${id}`, { method: "DELETE" });
      toast.success("Deleted", "Media removed from library");
      await loadMedia();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setError(msg);
      toast.error("Delete failed", msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Media library" subtitle="Drop, search, and reuse creative" nav={companyNav(companyId)} tone="#FF6B6B">
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Assets" value={assets.length} accent="#FF6B6B" />
        <StatCard label="Images" value={assets.filter((a) => a.kind === "IMAGE").length} accent="#00D2FF" />
        <StatCard label="Videos" value={assets.filter((a) => a.kind === "VIDEO").length} accent="#F0C14A" />
      </div>

      <div className="panel mb-5 grid gap-3 p-5 md:grid-cols-4">
        <select
          className="field"
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
          className="field md:col-span-2"
          placeholder="Search name or tag"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadMedia().catch(() => undefined);
          }}
        />
        <button className="btn-ghost" type="button" onClick={() => loadMedia()}>
          Search
        </button>
      </div>

      <form
        noValidate
        onSubmit={onUpload}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`panel mb-6 overflow-hidden p-0 ${dragOver ? "ring-2 ring-brand-primary" : ""}`}
      >
        <div
          className="cursor-pointer bg-gradient-to-br from-[#FF6B6B]/15 via-transparent to-[#00D2FF]/10 px-5 py-10 text-center"
          onClick={() => inputRef.current?.click()}
        >
          <p className="font-display text-xl font-semibold text-[var(--text)]">Drop media here</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            or click to choose images / videos · PNG, JPG, WEBP, MP4, WEBM
          </p>
          <input
            ref={inputRef}
            name="file"
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
            }}
          />
          <button
            type="submit"
            disabled={uploading || !clientId}
            className="btn-primary mt-5 disabled:opacity-50"
            onClick={(e) => e.stopPropagation()}
          >
            {uploading ? "Uploading…" : "Upload selected"}
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {assets.map((asset) => (
          <div key={asset.id} className="panel overflow-hidden">
            {asset.kind === "IMAGE" ? (
              <AuthImage assetId={asset.id} alt={asset.originalName} className="h-40 w-full object-cover" />
            ) : (
              <div className="grid h-40 place-items-center bg-[var(--elevated)] text-sm text-[var(--muted)]">
                {asset.kind}
              </div>
            )}
            <div className="space-y-2 p-3 text-sm">
              <p className="truncate font-medium">{asset.originalName}</p>
              <p className="text-xs text-[var(--muted)]">
                {(asset.sizeBytes / 1024).toFixed(1)} KB · {asset.folder}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                Uploaded {fmt(asset.createdAt)}
                {asset.updatedAt && asset.updatedAt !== asset.createdAt
                  ? ` · Updated ${fmt(asset.updatedAt)}`
                  : ""}
              </p>
              <div className="flex gap-2">
                <button
                  className="text-xs font-semibold text-brand-primary"
                  onClick={() =>
                    router.push(`/app/${companyId}/create?clientId=${clientId}&mediaId=${asset.id}`)
                  }
                >
                  Use in post
                </button>
                <button
                  className="text-xs font-semibold text-brand-error disabled:opacity-50"
                  disabled={busyId === asset.id}
                  onClick={() => remove(asset.id)}
                >
                  {busyId === asset.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
