"use client";

import { useEffect } from "react";
import { FALLBACK_BRANDING, type PublicBranding } from "@/lib/branding";

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

/**
 * CMS default theme applies for admin / company / client / landing unless the
 * user explicitly toggled via the sun icon (sr_theme_user).
 */
export function ThemeBoot() {
  useEffect(() => {
    const userChoice = localStorage.getItem("sr_theme_user") as "dark" | "light" | null;
    if (userChoice === "light" || userChoice === "dark") {
      localStorage.setItem("sr_theme", userChoice);
      applyTheme(userChoice);
      return;
    }

    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${api}/api/v1/branding`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Partial<PublicBranding> | null) => {
        const next =
          data?.themeDefault === "light" || data?.themeDefault === "dark"
            ? data.themeDefault
            : (FALLBACK_BRANDING.themeDefault as "dark" | "light");
        localStorage.setItem("sr_theme", next);
        applyTheme(next);
      })
      .catch(() => {
        applyTheme("dark");
      });
  }, []);

  return null;
}
