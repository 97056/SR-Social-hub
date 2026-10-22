"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Doc = { title: string; body: string; reviewStatus: string };

export default function LegalPage() {
  const params = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Doc>(`/api/legal/${params.slug}`).then(setDoc).catch(() => setError("This page is not available."));
  }, [params.slug]);

  if (error) return <p className="mx-auto max-w-3xl px-4 py-12">{error}</p>;
  if (!doc) return <p className="mx-auto max-w-3xl px-4 py-12">Loading…</p>;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {doc.reviewStatus !== "published" && (
        <p className="mb-4 rounded-brand bg-accent px-4 py-3 text-sm text-accent-foreground">
          Draft — not reviewed by counsel. Do not treat this as a final policy.
        </p>
      )}
      <h1 className="text-4xl font-semibold tracking-tight">{doc.title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        {doc.body.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </article>
  );
}
