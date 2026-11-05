import { toast } from "@/components/toast";

/** Soft email check for client-side toasts (server still validates). */
export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isIndianMobile(value: string) {
  return /^[6-9]\d{9}$/.test(value.trim());
}

export function requireFields(
  fields: Array<{ label: string; value: string; ok?: boolean }>,
): boolean {
  const missing = fields.filter((f) => (f.ok === undefined ? !f.value.trim() : !f.ok));
  if (!missing.length) return true;
  toast.error(
    "Please complete the form",
    missing.length === 1
      ? `${missing[0]!.label} is required.`
      : `Missing: ${missing.map((m) => m.label).join(", ")}.`,
  );
  return false;
}

export function fieldErrorClass(hasError?: boolean) {
  return hasError ? "!border-brand-error/70 ring-1 ring-brand-error/40" : "";
}
