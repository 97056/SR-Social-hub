"use client";

import { useState } from "react";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoComplete?: string;
};

export function PasswordField({
  label = "Password",
  value,
  onChange,
  placeholder = "••••••••",
  className,
  inputClassName = "field",
  autoComplete = "current-password",
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={className ?? "block text-xs text-content-muted"}>
      {label}
      <span className="relative mt-0 block">
        <input
          className={`${inputClassName} pr-12`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 px-3 text-[11px] font-semibold uppercase tracking-wide text-brand-primary hover:text-white"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
