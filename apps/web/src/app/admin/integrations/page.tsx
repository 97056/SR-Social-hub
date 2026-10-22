"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Integration = {
  provider: string;
  displayName: string;
  enabled: boolean;
  clientId?: string | null;
  secretSet: boolean;
  redirectUri?: string | null;
  scopes?: string | null;
  apiVersion?: string | null;
  environment: string;
  verificationStatus: string;
  docsUrl?: string;
  lastHealthMessage?: string | null;
};

export default function IntegrationsPage() {
  const [rows, setRows] = useState<Integration[]>([]);
  const [message, setMessage] = useState("");

  function load() {
    api<Integration[]>("/api/admin/integrations").then(setRows).catch((err) => setMessage(err instanceof ApiError ? err.message : "Could not load integrations."));
  }
  useEffect(load, []);

  async function save(event: FormEvent<HTMLFormElement>, provider: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const secret = String(form.get("secret") || "");
    try {
      await api(`/api/admin/integrations/${provider}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.get("enabled") === "on",
          clientId: form.get("clientId"),
          secret: secret || null,
          redirectUri: form.get("redirectUri"),
          scopes: form.get("scopes"),
          apiVersion: form.get("apiVersion"),
          environment: form.get("environment"),
        }),
      });
      setMessage(`${provider} saved. The secret is not returned to the browser.`);
      load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Provider settings</h1>
      <p className="mt-2 text-sm">Saving credentials does not mark a connector verified and does not call the provider.</p>
      {message && <p className="mt-4 text-sm">{message}</p>}
      <div className="mt-6 space-y-6">
        {rows.map((row) => (
          <form key={row.provider} onSubmit={(event) => save(event, row.provider)} className="space-y-3 rounded-brand bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{row.displayName}</h2>
              <span className="text-sm">{row.verificationStatus}{row.secretSet ? " · secret stored" : ""}</span>
            </div>
            <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={row.enabled} /> Enabled</label>
            <Input name="clientId" aria-label={`${row.displayName} client id`} placeholder="Client id" defaultValue={row.clientId ?? ""} />
            <Input name="secret" aria-label={`${row.displayName} secret`} placeholder={row.secretSet ? "Secret is stored. Enter a new value to rotate it." : "Secret"} type="password" autoComplete="off" />
            <Input name="redirectUri" aria-label="Redirect URI" placeholder="Redirect URI" defaultValue={row.redirectUri ?? ""} />
            <Input name="scopes" aria-label="Scopes" placeholder="Scopes" defaultValue={row.scopes ?? ""} />
            <Input name="apiVersion" aria-label="API version" placeholder="API version" defaultValue={row.apiVersion ?? ""} />
            <select name="environment" defaultValue={row.environment} aria-label="Environment" className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2">
              <option value="test">test</option>
              <option value="live">live</option>
            </select>
            {row.docsUrl && <a className="text-sm underline" href={row.docsUrl}>Official documentation</a>}
            <div><Button type="submit">Save</Button></div>
          </form>
        ))}
      </div>
    </div>
  );
}
