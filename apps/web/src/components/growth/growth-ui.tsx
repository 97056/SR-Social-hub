"use client";

import { ReactNode } from "react";
import { StatusPill } from "./status-pill";

export { StatusPill } from "./status-pill";

export function GrowthCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-[var(--text)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ClientSelect({
  clients,
  value,
  onChange,
}: {
  clients: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-xs text-content-muted">
      Client
      <select
        className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-content-muted">
      {text}
    </p>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-content-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function MetricGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-content-muted">{item.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function BulletList({ items, empty = "None listed" }: { items?: unknown; empty?: string }) {
  const list = Array.isArray(items) ? items.map(String).filter(Boolean) : [];
  if (!list.length) return <p className="text-sm text-content-muted">{empty}</p>;
  return (
    <ul className="space-y-1.5 text-sm text-content-muted">
      {list.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">{title}</p>
      <div className="text-sm leading-6 text-[var(--text)]">{children}</div>
    </div>
  );
}

function unwrapResult(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (obj.result && typeof obj.result === "object") return obj.result as Record<string, unknown>;
  return obj;
}

export function BusinessAnalysisView({ data }: { data: unknown }) {
  const r = unwrapResult(data);
  const swot = (r.swot as Record<string, unknown>) || {};
  const revenue = Array.isArray(r.revenueOpportunities) ? r.revenueOpportunities : [];
  return (
    <div className="space-y-3">
      <Section title="Business overview">
        <p>{String(r.businessOverview || "No overview yet.")}</p>
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Business model"><p>{String(r.businessModel || "—")}</p></Section>
        <Section title="Positioning"><p>{String(r.positioning || "—")}</p></Section>
        <Section title="Audience"><p>{String(r.audienceAnalysis || "—")}</p></Section>
        <Section title="Goals alignment"><p>{String(r.goalsAlignment || "—")}</p></Section>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Section title="Strengths"><BulletList items={swot.strengths} /></Section>
        <Section title="Weaknesses"><BulletList items={swot.weaknesses} /></Section>
        <Section title="Opportunities"><BulletList items={swot.opportunities} /></Section>
        <Section title="Threats"><BulletList items={swot.threats} /></Section>
      </div>
      <Section title="Customer pain points"><BulletList items={r.painPoints} /></Section>
      <Section title="Competitive advantages"><BulletList items={r.competitiveAdvantages} /></Section>
      <Section title="Revenue opportunities">
        <div className="space-y-3">
          {revenue.length ? revenue.map((item, idx) => {
            const row = item as Record<string, string>;
            return (
              <div key={idx} className="rounded-lg border border-white/10 px-3 py-2">
                <p className="font-medium text-white">{row.title || "Opportunity"}</p>
                <p className="mt-1 text-content-muted"><span className="text-white/70">Why: </span>{row.why}</p>
                <p className="text-content-muted"><span className="text-white/70">Next: </span>{row.next}</p>
              </div>
            );
          }) : <p className="text-content-muted">None yet.</p>}
        </div>
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="New offer ideas"><BulletList items={r.newOfferIdeas} /></Section>
        <Section title="Retention ideas"><BulletList items={r.retentionIdeas} /></Section>
      </div>
    </div>
  );
}

export function CompetitorAnalysisView({ data }: { data: unknown }) {
  const r = unwrapResult(data);
  const competitors = Array.isArray(r.competitors) ? r.competitors : [];
  return (
    <div className="space-y-3">
      <Section title="Summary"><p>{String(r.summary || "—")}</p></Section>
      {competitors.map((c, idx) => {
        const row = c as Record<string, unknown>;
        return (
          <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-white">{String(row.businessName || "Competitor")}</h3>
              <StatusPill value={String(row.confidence || "LOW")} />
            </div>
            {row.website ? (
              <a className="mt-1 inline-block text-xs text-brand-primary hover:underline" href={String(row.website)} target="_blank" rel="noreferrer">
                {String(row.website)}
              </a>
            ) : null}
            <p className="mt-2 text-sm text-content-muted">{String(row.positioning || "")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-content-muted">Strengths</p>
                <BulletList items={row.strengths} />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-content-muted">Weaknesses</p>
                <BulletList items={row.weaknesses} />
              </div>
            </div>
            <p className="mt-3 text-sm"><span className="text-content-muted">How to differentiate: </span>{String(row.differentiate || "—")}</p>
          </div>
        );
      })}
      {r.limitations ? <p className="text-xs text-content-muted">{String(r.limitations)}</p> : null}
    </div>
  );
}

export function WebsiteAuditView({ data }: { data: unknown }) {
  const r = unwrapResult(data);
  const issues = Array.isArray(r.issues) ? r.issues : [];
  const snapshot = (r.snapshot as Record<string, unknown>) || {};
  return (
    <div className="space-y-3">
      <Section title="Summary"><p>{String(r.summary || "—")}</p></Section>
      <div className="grid gap-3 sm:grid-cols-3">
        <Section title="Page title"><p>{String(snapshot.title || "Missing")}</p></Section>
        <Section title="HTTP status"><p>{String(snapshot.status ?? "—")}</p></Section>
        <Section title="Mobile viewport"><p>{snapshot.hasViewport ? "Detected" : "Not detected"}</p></Section>
      </div>
      <Section title="Issues by priority">
        <div className="space-y-3">
          {issues.map((issue, idx) => {
            const row = issue as Record<string, string>;
            return (
              <div key={idx} className="rounded-lg border border-white/10 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={row.priority || "Medium"} />
                  <p className="font-medium text-white">{row.issue}</p>
                </div>
                <p className="mt-2 text-content-muted"><span className="text-white/70">Evidence: </span>{row.evidence}</p>
                <p className="text-content-muted"><span className="text-white/70">Why it matters: </span>{row.explanation}</p>
                <p className="mt-1 text-brand-primary/90"><span className="text-white/70">Fix: </span>{row.solution}</p>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Next actions"><BulletList items={r.nextActions} /></Section>
    </div>
  );
}

export function SocialAuditView({ data }: { data: unknown }) {
  const r = unwrapResult(data);
  const accounts = Array.isArray(r.accounts) ? r.accounts : [];
  return (
    <div className="space-y-3">
      <Section title="Summary"><p>{String(r.summary || "—")}</p></Section>
      {accounts.length ? accounts.map((a, idx) => {
        const row = a as Record<string, string>;
        return (
          <div key={idx} className="rounded-xl border border-white/10 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-white">{row.platform} · {row.name || row.username || "Account"}</p>
              <StatusPill value={row.status || "UNKNOWN"} />
            </div>
            <p className="mt-2 text-sm text-content-muted">Profile completeness: {row.profileCompleteness}</p>
            <p className="text-sm text-content-muted">Engagement: {row.engagement}</p>
            <p className="mt-1 text-sm">{row.recommendation}</p>
          </div>
        );
      }) : <EmptyState text="No connected social accounts for this client." />}
      <Section title="Content gaps"><BulletList items={r.contentGaps} /></Section>
      <p className="text-xs text-content-muted">{String(r.limitations || "")}</p>
    </div>
  );
}

export function SeoAnalysisView({ data }: { data: unknown }) {
  const r = unwrapResult(data);
  const onPage = (r.onPage as Record<string, unknown>) || {};
  const keywords = (r.keywordTopics as { items?: string[] }) || {};
  const measured = onPage.measured !== false && !onPage.unavailableReason;
  const missingLabel = measured ? "Missing" : "Not measured (site fetch failed)";
  return (
    <div className="space-y-3">
      <Section title="Summary"><p>{String(r.summary || "—")}</p></Section>
      {!measured && onPage.unavailableReason ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {String(onPage.unavailableReason)}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Title tag"><p>{String(onPage.title || missingLabel)}</p></Section>
        <Section title="Meta description"><p>{String(onPage.metaDescription || missingLabel)}</p></Section>
        <Section title="Mobile viewport">
          <p>
            {onPage.hasViewport == null
              ? missingLabel
              : onPage.hasViewport
                ? "Detected"
                : measured
                  ? "Not detected"
                  : missingLabel}
          </p>
        </Section>
      </div>
      <Section title="Headings">
        <BulletList items={onPage.headings} empty={measured ? "No headings extracted" : missingLabel} />
      </Section>
      <Section title="Keyword / topic suggestions"><BulletList items={keywords.items} /></Section>
      <Section title="Content opportunities"><BulletList items={r.contentOpportunities} /></Section>
      <p className="text-xs text-content-muted">{String(r.limitations || "")}</p>
    </div>
  );
}

export function CampaignView({ data }: { data: unknown }) {
  const raw = data as Record<string, unknown>;
  const strategy = (raw.strategy as Record<string, unknown>) || unwrapResult(data);
  return (
    <div className="space-y-3">
      <Section title="Strategy"><p>{String(strategy.campaignStrategy || raw.name || "—")}</p></Section>
      <Section title="Content ideas"><BulletList items={strategy.contentIdeas} /></Section>
      <Section title="Captions"><BulletList items={strategy.captions} /></Section>
      <Section title="Hashtags"><BulletList items={strategy.hashtags} /></Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Poster concepts"><BulletList items={strategy.posterConcepts} /></Section>
        <Section title="Video concepts"><BulletList items={strategy.videoConcepts} /></Section>
      </div>
      <Section title="KPIs"><BulletList items={strategy.kpis} /></Section>
      <p className="text-xs text-content-muted">{String(strategy.scheduleHint || "")}</p>
    </div>
  );
}

export function OpportunityDiscoveryView({ data }: { data: unknown }) {
  const r = unwrapResult(data);
  const opps = Array.isArray(r.opportunities) ? r.opportunities : Array.isArray(data) ? (data as unknown[]) : [];
  if (r.emptyMessage && !opps.length) return <EmptyState text={String(r.emptyMessage)} />;
  return (
    <div className="space-y-3">
      {typeof r.discovered === "number" ? (
        <p className="text-sm text-content-muted">{r.discovered} opportunity record(s) ready in the inbox.</p>
      ) : null}
      {opps.map((o, idx) => {
        const row = o as Record<string, string>;
        return (
          <div key={row.id || idx} className="rounded-xl border border-white/10 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={row.priority || "MEDIUM"} />
              <p className="font-medium text-white">{row.title}</p>
            </div>
            <p className="mt-2 text-sm text-content-muted">{row.description}</p>
            <p className="mt-1 text-sm"><span className="text-content-muted">Action: </span>{row.recommendedAction}</p>
          </div>
        );
      })}
    </div>
  );
}

export function GrowthPlanView({ data }: { data: unknown }) {
  const plan = data as Record<string, unknown>;
  const milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={String(plan.status || "DRAFT")} />
        <span className="text-sm text-content-muted">{String(plan.horizonDays || "—")}-day horizon</span>
      </div>
      <Section title="Summary"><p>{String(plan.summary || "—")}</p></Section>
      <Section title="Objectives"><BulletList items={plan.objectives} /></Section>
      <Section title="Strategies"><BulletList items={plan.strategies} /></Section>
      <Section title="Milestones">
        <ul className="space-y-2">
          {milestones.map((m) => {
            const row = m as Record<string, string>;
            return (
              <li key={row.id || row.title} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                {row.title}
                {row.dueDate ? <span className="ml-2 text-content-muted">due {new Date(row.dueDate).toLocaleDateString()}</span> : null}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

/** Generic readable renderer for Growth run payloads. */
export function GrowthResultView({ kind, data }: { kind?: string; data: unknown }) {
  const k = (kind || "").toUpperCase();
  if (k.includes("BUSINESS")) return <BusinessAnalysisView data={data} />;
  if (k.includes("COMPETITOR")) return <CompetitorAnalysisView data={data} />;
  if (k.includes("WEBSITE")) return <WebsiteAuditView data={data} />;
  if (k.includes("SOCIAL")) return <SocialAuditView data={data} />;
  if (k.includes("SEO")) return <SeoAnalysisView data={data} />;
  if (k.includes("CAMPAIGN")) return <CampaignView data={data} />;
  if (k.includes("OPPORTUNITY")) return <OpportunityDiscoveryView data={data} />;
  if (k.includes("PLAN") || (data as { horizonDays?: number })?.horizonDays) return <GrowthPlanView data={data} />;
  return <BusinessAnalysisView data={data} />;
}
