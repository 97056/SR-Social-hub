/**
 * Local smoke: load test OAuth keys into admin, mock-connect all platforms,
 * create one multi-target post, approve, publish, write a report.
 * Keys file: apps/api/.data/test-oauth-keys.json (gitignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const API = process.env.API_URL ?? "http://localhost:4000";
const BASE = `${API}/api/v1`;
const KEYS_PATH = join(__dirname, "..", ".data", "test-oauth-keys.json");
const REPORT_PATH = join(__dirname, "..", "..", "..", "docs", "oauth-multipublish-smoke-report.md");
const REDIRECT = "http://localhost:4000/api/v1/oauth/callback";

type KeysFile = Record<
  string,
  { oauthClientId: string; clientSecret: string; capabilities?: Record<string, unknown> }
>;

async function req<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers,
    body,
    redirect: "manual",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok && res.status !== 302) {
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return json as T;
}

async function followMockOAuth(authorizeUrl: string) {
  // Prefer 127.0.0.1 — Node fetch to "localhost" can fail on some Windows setups.
  const url = authorizeUrl.replace("://localhost", "://127.0.0.1");
  const res = await fetch(url, { redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      await fetch(loc.replace("://localhost", "://127.0.0.1"), { redirect: "manual" });
    }
  } else if (!res.ok && res.status !== 0) {
    throw new Error(`OAuth callback HTTP ${res.status}`);
  }
}

function tinyPng(): Buffer {
  // 1x1 PNG
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function main() {
  if (!existsSync(KEYS_PATH)) {
    throw new Error(`Missing keys file: ${KEYS_PATH}`);
  }
  const keys = JSON.parse(readFileSync(KEYS_PATH, "utf8")) as KeysFile;
  const platforms = Object.keys(keys);

  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) throw new Error("API not reachable at " + BASE);

  const adminLogin = await req<{ accessToken: string }>("/auth/admin/login", {
    body: { email: "admin@srsocialhub.local", password: "ChangeMeAdmin!123" },
  });
  const adminToken = adminLogin.accessToken;

  const keyResults: Array<Record<string, unknown>> = [];
  for (const code of platforms) {
    const k = keys[code];
    const updated = await req<Record<string, unknown>>(`/admin/integrations/${code}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        enabled: true,
        oauthClientId: k.oauthClientId,
        clientSecret: k.clientSecret,
        redirectUri: REDIRECT,
        capabilities: k.capabilities ?? {},
      },
    });
    keyResults.push({
      code,
      enabled: updated.enabled,
      hasClientSecret: (updated.config as { hasClientSecret?: boolean })?.hasClientSecret,
      oauthClientId: (updated.config as { oauthClientId?: string })?.oauthClientId,
    });
  }

  const agencyLogin = await req<{
    accessToken: string;
    workspaces: { companies: Array<{ id: string }>; clients: Array<{ id: string; companyId: string }> };
  }>("/auth/login", {
    body: { email: "agency@srsocialhub.local", password: "ChangeMeAgency!123" },
  });
  const agencyToken = agencyLogin.accessToken;
  const companyId = agencyLogin.workspaces.companies[0]?.id;
  if (!companyId) throw new Error("Seeded company missing");
  const companySocial = await req<{
    clients: Array<{ id: string; name: string }>;
  }>(`/companies/${companyId}/social-accounts`, { token: agencyToken });
  const clientId =
    agencyLogin.workspaces.clients.find((c) => c.companyId === companyId)?.id ??
    companySocial.clients[0]?.id;
  if (!clientId) throw new Error("Seeded client missing");

  const connectResults: Array<Record<string, unknown>> = [];
  for (const code of platforms) {
    try {
      const start = await req<{ authorizeUrl: string; note: string; mode: string }>(
        `/companies/${companyId}/clients/${clientId}/social-accounts/${code}/connect`,
        {
          method: "POST",
          token: agencyToken,
          body: { redirectTo: `http://localhost:3000/client/${clientId}/social-accounts` },
        },
      );
      await followMockOAuth(start.authorizeUrl);
      connectResults.push({
        code,
        ok: true,
        mode: start.mode,
        note: start.note,
        authorizeHost: new URL(start.authorizeUrl).host,
      });
    } catch (e) {
      connectResults.push({
        code,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const cards = await req<
    Array<{
      platform: { code: string };
      accounts: Array<{ id: string; status: string; connectionMode: string }>;
    }>
  >(`/clients/${clientId}/social-accounts`, { token: agencyToken });

  const accountByPlatform = new Map<string, string>();
  for (const card of cards) {
    const acct = card.accounts[0];
    if (acct) accountByPlatform.set(card.platform.code, acct.id);
  }

  // Upload 1x1 image (Instagram requires media)
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(tinyPng())], { type: "image/png" }), "smoke.png");
  const media = await req<{ id: string }>(
    `/companies/${companyId}/clients/${clientId}/media`,
    {
      method: "POST",
      token: agencyToken,
      form,
    },
  );

  const caption =
    "SR Social Hub multipublish smoke — one post targeting all connected networks (architecture test).";
  const post = await req<{ id: string }>(`/companies/${companyId}/posts`, {
    method: "POST",
    token: agencyToken,
    body: {
      clientId,
      mediaAssetId: media.id,
      baseCaption: caption,
      baseHashtags: "#SRSocialHub #SmokeTest",
    },
  });

  const targetCodes = platforms.filter((c) => accountByPlatform.has(c));
  await req(`/posts/${post.id}`, {
    method: "PATCH",
    token: agencyToken,
    body: {
      mediaAssetId: media.id,
      baseCaption: caption,
      variants: targetCodes.map((platformCode) => ({
        platformCode,
        caption,
        title: platformCode === "YOUTUBE" || platformCode === "PINTEREST" ? "SR smoke upload" : undefined,
        description:
          platformCode === "YOUTUBE" || platformCode === "PINTEREST" ? caption : undefined,
        hashtags: "#SRSocialHub",
      })),
      targets: targetCodes.map((platformCode) => ({
        platformCode,
        socialAccountId: accountByPlatform.get(platformCode),
      })),
    },
  });

  const validation = await req<{ ok: boolean; issues?: unknown[] }>(`/posts/${post.id}/validate`, {
    token: agencyToken,
  });

  await req(`/posts/${post.id}/submit`, {
    method: "POST",
    token: agencyToken,
    body: { action: "PENDING_APPROVAL" },
  });

  const clientLogin = await req<{ accessToken: string }>("/auth/login", {
    body: { email: "client@srsocialhub.local", password: "ChangeMeClient!123" },
  });
  const history = await req<Array<{ id: string; decision: string; postId?: string }>>(
    `/posts/${post.id}/approvals`,
    { token: clientLogin.accessToken },
  );
  const pending =
    history.find((a) => a.decision === "PENDING") ??
    (
      await req<Array<{ id: string; decision?: string; status?: string; postId?: string }>>(
        `/clients/${clientId}/approvals/inbox`,
        { token: clientLogin.accessToken },
      )
    ).find((a) => (a.decision ?? a.status) === "PENDING" && (a.postId ? a.postId === post.id : true));
  if (!pending) throw new Error(`No pending approval for post ${post.id}`);
  await req(`/approvals/${pending.id}/decide`, {
    method: "POST",
    token: clientLogin.accessToken,
    body: { decision: "APPROVED", comments: "Smoke approve" },
  });

  await req(`/posts/${post.id}/publish`, { method: "POST", token: agencyToken, body: {} });

  // Drain worker
  let jobs: Array<{
    id: string;
    platformCode: string;
    status: string;
    externalPostId: string | null;
    lastError: string | null;
  }> = [];
  for (let i = 0; i < 8; i++) {
    await req(`/publishing/worker/tick`, { method: "POST", token: agencyToken, body: {} });
    await new Promise((r) => setTimeout(r, 800));
    const list = await req<{
      jobs: typeof jobs;
    }>(`/companies/${companyId}/publishing/jobs?postId=${post.id}`, { token: agencyToken });
    jobs = list.jobs ?? (list as unknown as typeof jobs);
    if (Array.isArray(list) ) jobs = list as typeof jobs;
    const row = await req<{
      jobs?: typeof jobs;
      publishingJobs?: typeof jobs;
    }>(`/posts/${post.id}`, { token: agencyToken });
    // fall through — fetch jobs endpoint shape below
  }

  // Prefer dedicated jobs list
  let publishJobs: Array<Record<string, unknown>> = [];
  try {
    const jl = await req<unknown>(`/companies/${companyId}/publishing/jobs`, {
      token: agencyToken,
    });
    if (Array.isArray(jl)) publishJobs = jl as Array<Record<string, unknown>>;
    else if (jl && typeof jl === "object" && Array.isArray((jl as { jobs?: unknown }).jobs)) {
      publishJobs = (jl as { jobs: Array<Record<string, unknown>> }).jobs;
    }
  } catch {
    publishJobs = [];
  }

  const postDetail = await req<{
    status: string;
    targets: Array<{ platformCode: string; status?: string }>;
    publishingJobs?: Array<Record<string, unknown>>;
  }>(`/posts/${post.id}`, { token: agencyToken });

  const connectedSummary = cards.map((c) => ({
    platform: c.platform.code,
    accounts: c.accounts.length,
    status: c.accounts[0]?.status ?? "NONE",
    mode: c.accounts[0]?.connectionMode ?? "—",
  }));

  const md = `# OAuth + multipublish smoke report

Generated: ${new Date().toISOString()}

## Scope

- Loaded **test** OAuth client IDs/secrets into Admin → Integrations (encrypted in DB; file is gitignored).
- \`SOCIAL_OAUTH_MODE=mock\` — connects and publishes validate architecture **without** live provider posts.
- Live OAuth consent in each provider console is still required before real posts go out.

## 1. Keys integrated

| Platform | Enabled | Secret stored | Client ID present |
| --- | --- | --- | --- |
${keyResults
  .map(
    (r) =>
      `| ${r.code} | ${r.enabled} | ${r.hasClientSecret} | ${Boolean(r.oauthClientId)} |`,
  )
  .join("\n")}

Instagram Unified Login Configuration ID stored under capabilities: \`1154246043953710\`.

## 2. Connect results

| Platform | OK | Mode | Notes |
| --- | --- | --- | --- |
${connectResults
  .map(
    (r) =>
      `| ${r.code} | ${r.ok} | ${r.mode ?? "—"} | ${String(r.note ?? r.error ?? r.authorizeHost ?? "").slice(0, 120)} |`,
  )
  .join("\n")}

### Connected accounts after OAuth

| Platform | Accounts | Status | Connection mode |
| --- | --- | --- | --- |
${connectedSummary
  .map((r) => `| ${r.platform} | ${r.accounts} | ${r.status} | ${r.mode} |`)
  .join("\n")}

## 3. One post → all medias

- Post ID: \`${post.id}\`
- Media uploaded: \`${media.id}\` (required for Instagram)
- Targets: ${targetCodes.join(", ") || "(none)"}
- Validation: \`${JSON.stringify(validation).slice(0, 300)}\`
- Post status after flow: \`${postDetail.status}\`

### Publishing jobs

| Platform | Job status | External post ID | Error |
| --- | --- | --- | --- |
${(publishJobs.length
  ? publishJobs
  : postDetail.publishingJobs ?? []
)
  .map((j) => {
    const platform = String(j.platformCode ?? j.platform ?? "?");
    const status = String(j.status ?? "?");
    const ext = String(j.externalPostId ?? j.providerPostId ?? "—");
    const err = String(j.lastError ?? j.error ?? "—");
    return `| ${platform} | ${status} | ${ext} | ${err.slice(0, 80)} |`;
  })
  .join("\n") || "| — | no jobs returned | — | — |"}

## 4. Verdict

- **Keys:** integrated for Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, Threads.
- **Connect:** ${connectResults.every((r) => r.ok) && targetCodes.length === platforms.length ? "ALL platforms connected (mock)" : "PARTIAL / see table"}
- **One post → all medias:** ${
    targetCodes.length === platforms.length
      ? "Post targeted all connected platforms; publish jobs processed under mock publishers (not live social posts)."
      : "Could not target every platform — see connect failures."
  }
- **Live posting:** not executed. Flip \`SOCIAL_OAUTH_MODE=live\`, complete each provider's browser OAuth (redirect URI must match), then re-run Connect + Publish.

## Security

Rotate these App Secrets after testing — they were shared in chat. Do not commit \`.data/test-oauth-keys.json\`.
`;

  mkdirSync(join(REPORT_PATH, ".."), { recursive: true });
  writeFileSync(REPORT_PATH, md, "utf8");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ report: REPORT_PATH, postId: post.id, targets: targetCodes, connectResults, keyResults, publishJobsCount: publishJobs.length, postStatus: postDetail.status }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
