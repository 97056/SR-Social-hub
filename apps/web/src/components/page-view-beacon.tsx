"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/api";

const TRACKED = new Set([
  "/",
  "/register",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/activate",
  "/privacy",
  "/terms",
  "/support",
  "/delete-account",
  "/integrations",
  "/invite/accept",
]);

/** Fire-and-forget public pageview for Super Admin visitor analytics. */
export function PageViewBeacon() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const path = pathname.split("?")[0] || "/";
    if (
      path.startsWith("/app") ||
      path.startsWith("/admin") ||
      path.startsWith("/client") ||
      (!TRACKED.has(path) && path !== "/")
    ) {
      return;
    }

    const day = new Date().toISOString().slice(0, 10);
    const key = `sr_pv_${path}_${day}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode */
    }

    void fetch(apiUrl("/public/pageview"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "SRSocialHub",
      },
      body: JSON.stringify({ path, referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
