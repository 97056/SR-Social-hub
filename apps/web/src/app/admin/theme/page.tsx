"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, api, type ThemeTokens } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fonts = ["Inter", "Source Sans 3", "IBM Plex Sans", "Nunito Sans"];

export default function ThemeAdminPage() {
  const [theme, setTheme] = useState<ThemeTokens | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<ThemeTokens>("/api/theme").then(setTheme).catch(() => setMessage("Sign in as a super admin with MFA enabled."));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const saved = await api<ThemeTokens>("/api/admin/theme", { method: "PUT", body: JSON.stringify(body) });
      setTheme(saved);
      setMessage("Theme saved. The public site picks it up without a redeploy.");
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not save the theme.");
    }
  }

  if (!theme) return <p className="mx-auto max-w-3xl px-4 py-12">{message || "Loading theme…"}</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Appearance</h1>
      <p className="mt-2 text-sm">Colors are checked for WCAG AA contrast. Markup in the brand name is rejected.</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field name="brandName" label="Brand name" defaultValue={theme.brandName} />
        <Field name="logoUrl" label="Logo URL" defaultValue={theme.logoUrl ?? ""} />
        <Field name="faviconUrl" label="Favicon URL" defaultValue={theme.faviconUrl ?? ""} />
        <Field name="primaryColor" label="Primary" defaultValue={theme.primaryColor} />
        <Field name="secondaryColor" label="Secondary" defaultValue={theme.secondaryColor} />
        <Field name="accentColor" label="Accent" defaultValue={theme.accentColor} />
        <Field name="backgroundColor" label="Background" defaultValue={theme.backgroundColor} />
        <Field name="surfaceColor" label="Surface" defaultValue={theme.surfaceColor} />
        <Field name="textColor" label="Text" defaultValue={theme.textColor} />
        <div>
          <Label htmlFor="fontFamily">Font</Label>
          <select id="fontFamily" name="fontFamily" defaultValue={theme.fontFamily} className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2">
            {fonts.map((font) => <option key={font}>{font}</option>)}
          </select>
        </div>
        <Field name="fontSizeBase" label="Base size" defaultValue={theme.fontSizeBase} />
        <Field name="radius" label="Radius" defaultValue={theme.radius} />
        <div>
          <Label htmlFor="buttonStyle">Buttons</Label>
          <select id="buttonStyle" name="buttonStyle" defaultValue={theme.buttonStyle} className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2">
            <option value="solid">solid</option>
            <option value="outline">outline</option>
            <option value="soft">soft</option>
          </select>
        </div>
        <div>
          <Label htmlFor="colorMode">Mode</Label>
          <select id="colorMode" name="colorMode" defaultValue={theme.colorMode} className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2">
            <option value="light">light</option>
            <option value="dark">dark</option>
            <option value="system">system</option>
          </select>
        </div>
        <div className="md:col-span-2"><Button type="submit">Save theme</Button></div>
      </form>
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return <div><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue} /></div>;
}
