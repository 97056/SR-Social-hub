import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-brand border border-black/10 bg-surface px-3 py-2 text-ink shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
