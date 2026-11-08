export function StatusPill({ value }: { value: string }) {
  const tone =
    /DONE|COMPLETED|APPROVED|ACTIVE|HIGH|GOOD/i.test(value)
      ? "bg-emerald-500/15 text-emerald-300"
      : /FAIL|REJECT|CRITICAL|BLOCKED|NONE/i.test(value)
        ? "bg-rose-500/15 text-rose-300"
        : /PROGRESS|REVIEW|PENDING|NEW|MEDIUM|LOW/i.test(value)
          ? "bg-amber-500/15 text-amber-200"
          : "bg-white/10 text-[var(--muted)]";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}
