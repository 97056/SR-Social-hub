"use client";

import { useEffect, useState } from "react";
import { apiUrl, getToken } from "@/lib/api";

export function AuthImage({
  assetId,
  alt,
  className,
}: {
  assetId: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      const token = getToken();
      const res = await fetch(apiUrl(`/media/${assetId}/file`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setSrc(objectUrl);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  if (!src) {
    return <div className={`animate-pulse rounded-xl bg-ink-elevated ${className ?? ""}`} />;
  }
  return <img src={src} alt={alt} className={className} />;
}
