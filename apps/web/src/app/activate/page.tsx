"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";

function ActivateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Activating your account…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing activation token.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await apiFetch<{ message: string }>("/auth/activate", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        setStatus("ok");
        setMessage(result.message || "Account activated.");
        toast.success("Account activated", "You can sign in now.");
        router.replace("/login");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Activation failed");
        toast.error(
          "Activation failed",
          err instanceof Error ? err.message : "Link may be expired or already used.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <main className="landing relative flex min-h-screen items-center justify-center overflow-x-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
        <div className="landing-grid" />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/30 p-8 text-center shadow-[0_0_40px_rgba(0,210,255,0.08)] backdrop-blur">
        <Image
          src="/brand/logo-mark.png"
          alt="SR Social Hub"
          width={64}
          height={64}
          className="mx-auto h-16 w-16 rounded-full object-cover"
          priority
        />
        <p className="landing-eyebrow mt-5 text-[11px] font-semibold uppercase tracking-[0.28em]">
          Activation
        </p>
        <h1 className="landing-heading mt-3 font-display text-2xl font-semibold">
          {status === "working" ? "Confirming email…" : status === "ok" ? "You're in" : "Could not activate"}
        </h1>
        <p className="mt-3 text-sm text-content-muted">{message}</p>
        {status !== "working" ? (
          <Link href="/login" className="landing-cta mt-6 inline-flex px-5 py-3 text-sm font-semibold">
            Go to sign in
          </Link>
        ) : null}
      </div>
    </main>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <main className="landing flex min-h-screen items-center justify-center text-content-muted">
          Loading…
        </main>
      }
    >
      <ActivateInner />
    </Suspense>
  );
}
