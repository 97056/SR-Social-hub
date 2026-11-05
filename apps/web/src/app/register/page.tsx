"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";

type AccountKind = "INDIVIDUAL" | "COMPANY";

type FieldKey =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "phone"
  | "companyName"
  | "gstNumber"
  | "gstFile";

type FieldErrors = Partial<Record<FieldKey, string>>;

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function isValidMobile(phone: string) {
  return /^[6-9]\d{9}$/.test(phone);
}

function fieldClass(hasError?: boolean) {
  return `field ${hasError ? "!border-brand-error/70 ring-1 ring-brand-error/40" : ""}`;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 3l18 18" strokeLinecap="round" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" strokeLinecap="round" />
        <path
          d="M9.9 5.2A10.4 10.4 0 0112 5c5 0 9.3 3.1 11 7.5a12.3 12.3 0 01-4.2 5.1M6.1 6.1A12.4 12.4 0 001 12.5C2.7 16.9 7 20 12 20c1.7 0 3.3-.4 4.7-1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z" />
      <circle cx="12" cy="12.5" r="3" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [kind, setKind] = useState<AccountKind>("INDIVIDUAL");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  function clearError(key: FieldKey) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (fullName.trim().length < 2) next.fullName = "Enter your full name (at least 2 characters).";
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";

    if (!password) next.password = "Password is required.";
    else if (!isStrongPassword(password)) {
      next.password = "Password needs 8+ chars with upper, lower, number, and special character.";
    }

    if (!confirmPassword) next.confirmPassword = "Confirm your password.";
    else if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";

    if (!phone.trim()) next.phone = "Mobile number is required.";
    else if (!/^[6-9]/.test(phone.trim())) {
      next.phone = "Enter a correct mobile number. It must start with 6, 7, 8, or 9.";
    } else if (!isValidMobile(phone.trim())) {
      next.phone = "Enter a correct 10-digit mobile number.";
    }

    if (kind === "COMPANY") {
      if (!companyName.trim()) next.companyName = "Company name is required.";
      if (!gstNumber.trim()) next.gstNumber = "GST number is required.";
      else if (!/^[0-9A-Z]{15}$/i.test(gstNumber.trim())) {
        next.gstNumber = "GST number must be 15 characters.";
      }
      if (!gstFile) next.gstFile = "Upload your GST certificate PDF.";
      else if (gstFile.type !== "application/pdf") next.gstFile = "GST document must be a PDF.";
      else if (gstFile.size > 8 * 1024 * 1024) next.gstFile = "GST PDF must be under 8MB.";
    }

    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);

    const keys = Object.keys(next) as FieldKey[];
    if (keys.length) {
      toast.warning("Please fix the highlighted fields", next[keys[0]]);
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.append("accountKind", kind);
      body.append("fullName", fullName.trim());
      body.append("email", email.trim());
      body.append("password", password);
      body.append("phone", phone.trim());
      if (kind === "COMPANY") {
        body.append("companyName", companyName.trim());
        if (website.trim()) body.append("website", website.trim());
        body.append("gstNumber", gstNumber.trim().toUpperCase());
        if (gstFile) body.append("gstDocument", gstFile);
      }

      const result = await apiFetch<{ message: string }>("/auth/register", {
        method: "POST",
        body,
      });

      toast.success(
        "Check your inbox",
        result.message || "We sent an activation link. Click it to unlock your account.",
      );
      router.push("/login");
    } catch (err) {
      toast.error("Registration failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
        <div className="landing-grid" />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo-mark.png"
              alt="SR Social Hub"
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
              priority
            />
            <span className="font-display text-lg font-semibold text-white">SR Social Hub</span>
          </Link>
          <Link href="/login" className="text-sm text-brand-primary hover:underline">
            Already have an account?
          </Link>
        </div>

        <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
          Create account
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">
          Register your <span className="landing-heading-underline">workspace</span>
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5">
          {(
            [
              { id: "INDIVIDUAL", label: "Individual" },
              { id: "COMPANY", label: "Company" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setKind(opt.id);
                setErrors({});
              }}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                kind === opt.id
                  ? "bg-gradient-to-r from-brand-primary/90 to-brand-secondary/90 text-ink-base shadow-[0_0_24px_rgba(0,210,255,0.25)]"
                  : "text-content-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form
          noValidate
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[0_0_40px_rgba(0,210,255,0.08)] backdrop-blur sm:p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-content-muted">
              Full name *
              <input
                className={fieldClass(!!errors.fullName)}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearError("fullName");
                }}
                placeholder="Your name"
              />
              {errors.fullName ? <p className="mt-1 text-[11px] text-brand-error">{errors.fullName}</p> : null}
            </label>
            <label className="block text-xs text-content-muted">
              Email *
              <input
                className={fieldClass(!!errors.email)}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                placeholder="you@company.com"
              />
              {errors.email ? <p className="mt-1 text-[11px] text-brand-error">{errors.email}</p> : null}
            </label>

            <div>
              <label className="block text-xs text-content-muted">
                Password *
                <div className="relative mt-1">
                  <input
                    className={`${fieldClass(!!errors.password)} pr-12`}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError("password");
                    }}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-white"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>
              {errors.password ? (
                <p className="mt-1 text-[11px] text-brand-error">{errors.password}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs text-content-muted">
                Confirm password *
                <div className="relative mt-1">
                  <input
                    className={`${fieldClass(!!errors.confirmPassword)} pr-12`}
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearError("confirmPassword");
                    }}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-white"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </label>
              {errors.confirmPassword ? (
                <p className="mt-1 text-[11px] text-brand-error">{errors.confirmPassword}</p>
              ) : null}
            </div>

            <label className="block text-xs text-content-muted sm:col-span-2">
              Mobile *
              <input
                className={fieldClass(!!errors.phone)}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length > 0 && !/^[6-9]/.test(digits)) {
                    setPhone("");
                    setErrors((prev) => ({
                      ...prev,
                      phone: "Enter a correct mobile number. It must start with 6, 7, 8, or 9.",
                    }));
                    return;
                  }
                  setPhone(digits);
                  if (digits.length === 10 && !isValidMobile(digits)) {
                    setErrors((prev) => ({
                      ...prev,
                      phone: "Enter a correct 10-digit mobile number.",
                    }));
                  } else {
                    clearError("phone");
                  }
                }}
                placeholder="9876543210"
              />
              {errors.phone ? <p className="mt-1 text-[11px] text-brand-error">{errors.phone}</p> : null}
            </label>
          </div>

          {kind === "COMPANY" ? (
            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
              <p className="sm:col-span-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">
                Company &amp; GST verification
              </p>
              <label className="block text-xs text-content-muted">
                Company name *
                <input
                  className={fieldClass(!!errors.companyName)}
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    clearError("companyName");
                  }}
                  placeholder="Legal company name"
                />
                {errors.companyName ? (
                  <p className="mt-1 text-[11px] text-brand-error">{errors.companyName}</p>
                ) : null}
              </label>
              <label className="block text-xs text-content-muted">
                Website
                <input
                  className="field"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label className="block text-xs text-content-muted">
                GST number *
                <input
                  className={`${fieldClass(!!errors.gstNumber)} uppercase`}
                  value={gstNumber}
                  onChange={(e) => {
                    setGstNumber(e.target.value.toUpperCase());
                    clearError("gstNumber");
                  }}
                  maxLength={15}
                  placeholder="22AAAAA0000A1Z5"
                />
                {errors.gstNumber ? (
                  <p className="mt-1 text-[11px] text-brand-error">{errors.gstNumber}</p>
                ) : null}
              </label>
              <label className="block text-xs text-content-muted">
                GST certificate (PDF) *
                <input
                  className={`${fieldClass(!!errors.gstFile)} file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white`}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    setGstFile(e.target.files?.[0] ?? null);
                    clearError("gstFile");
                  }}
                />
                {errors.gstFile ? (
                  <p className="mt-1 text-[11px] text-brand-error">{errors.gstFile}</p>
                ) : null}
              </label>
            </div>
          ) : null}

          <button disabled={loading} className="landing-cta w-full px-4 py-3 text-sm font-semibold disabled:opacity-50">
            {loading ? "Creating account…" : "Create account"}
          </button>
          <p className="text-center text-xs text-content-muted">
            Sign in only after you click Activate in the email we send you.
          </p>
        </form>
      </div>
    </main>
  );
}
