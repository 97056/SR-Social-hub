"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastInput = {
  title: string;
  message?: string;
  kind?: ToastKind;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  kind: ToastKind;
};

type ToastApi = {
  push: (input: ToastInput) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<ToastKind, { bar: string; glow: string; label: string }> = {
  success: { bar: "#3DDC97", glow: "rgba(61,220,151,0.22)", label: "Success" },
  error: { bar: "#FF6B6B", glow: "rgba(255,107,107,0.22)", label: "Error" },
  warning: { bar: "#F0C14A", glow: "rgba(240,193,74,0.22)", label: "Warning" },
  info: { bar: "#00D2FF", glow: "rgba(0,210,255,0.22)", label: "Info" },
};

let externalPush: ((input: ToastInput) => void) | null = null;

/** Imperative toast API (usable outside React components). */
export const toast: ToastApi = {
  push(input) {
    externalPush?.(input);
  },
  success(title, message) {
    externalPush?.({ kind: "success", title, message });
  },
  error(title, message) {
    externalPush?.({ kind: "error", title, message });
  },
  warning(title, message) {
    externalPush?.({ kind: "warning", title, message });
  },
  info(title, message) {
    externalPush?.({ kind: "info", title, message });
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kind = input.kind ?? "info";
      const durationMs = input.durationMs ?? (kind === "error" ? 5200 : 3600);
      setItems((prev) => [...prev.slice(-4), { ...input, id, kind }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  useEffect(() => {
    externalPush = push;
    return () => {
      if (externalPush === push) externalPush = null;
    };
  }, [push]);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, message) => push({ kind: "success", title, message }),
      error: (title, message) => push({ kind: "error", title, message }),
      warning: (title, message) => push({ kind: "warning", title, message }),
      info: (title, message) => push({ kind: "info", title, message }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-end gap-2 p-3 sm:p-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const style = KIND_STYLE[item.kind];
          return (
            <div
              key={item.id}
              className="pointer-events-auto w-full max-w-sm animate-[toastIn_0.28s_ease] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-panel"
              style={{ boxShadow: `0 12px 40px rgba(0,0,0,0.28), 0 0 0 1px ${style.glow}` }}
              role="status"
            >
              <div className="flex gap-3 p-3.5">
                <span className="mt-0.5 h-10 w-1 shrink-0 rounded-full" style={{ background: style.bar }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: style.bar }}>
                    {style.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">{item.title}</p>
                  {item.message ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.message}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 self-start rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--elevated)] hover:text-[var(--text)]"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return toast;
  return ctx;
}
