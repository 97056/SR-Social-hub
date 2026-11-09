/**
 * `datetime-local` values are wall-clock local time without a timezone.
 * Browsers parse them as local; Node often parses the same string as UTC.
 * Always convert in the browser before sending to the API.
 */
export function localDateTimeInputToIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  // Ensure the browser treats it as local wall time (append seconds if missing).
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isoToLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
