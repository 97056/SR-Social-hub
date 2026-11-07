const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-white/10 text-[var(--muted)]",
  PENDING_APPROVAL: "bg-[#F0C14A]/20 text-[#F0C14A] ring-1 ring-[#F0C14A]/40",
  APPROVED: "bg-[#3DDC97]/20 text-[#3DDC97] ring-1 ring-[#3DDC97]/40",
  SCHEDULED: "bg-[#7B5CFF]/20 text-[#B9A8FF] ring-1 ring-[#7B5CFF]/40",
  PUBLISHING: "bg-[#00D2FF]/20 text-[#00D2FF] ring-1 ring-[#00D2FF]/40",
  PUBLISHED: "bg-[#3DDC97]/25 text-[#3DDC97] ring-1 ring-[#3DDC97]/50",
  FAILED: "bg-[#FF6B6B]/20 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/45",
  REJECTED: "bg-[#FF6B6B]/20 text-[#FF8E8E] ring-1 ring-[#FF6B6B]/40",
  CHANGES_REQUESTED: "bg-[#FFB020]/20 text-[#FFB020] ring-1 ring-[#FFB020]/40",
  CONNECTED: "bg-[#3DDC97]/20 text-[#3DDC97] ring-1 ring-[#3DDC97]/40",
  DISCONNECTED: "bg-white/10 text-[var(--muted)] ring-1 ring-white/15",
  REQUIRES_REAUTH: "bg-[#FFB020]/20 text-[#FFB020] ring-1 ring-[#FFB020]/40",
};

export function statusBadgeClass(status: string) {
  return STATUS_STYLES[status] ?? "bg-white/10 text-[var(--muted)] ring-1 ring-white/10";
}

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(status)} ${className}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
