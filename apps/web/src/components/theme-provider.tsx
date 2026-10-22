"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type ThemeTokens } from "@/lib/api";

const ThemeContext = createContext<ThemeTokens | null>(null);

const fontVariable: Record<string, string> = {
  Inter: "var(--font-inter)",
  "Source Sans 3": "var(--font-source-sans)",
  "IBM Plex Sans": "var(--font-ibm-plex)",
  "Nunito Sans": "var(--font-nunito)",
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeTokens | null>(null);

  useEffect(() => {
    api<ThemeTokens>("/api/theme")
      .then((tokens) => {
        setTheme(tokens);
        const root = document.documentElement;
        const pairs: Record<string, string> = {
          "--background": tokens.backgroundColor,
          "--surface": tokens.surfaceColor,
          "--text": tokens.textColor,
          "--primary": tokens.primaryColor,
          "--secondary": tokens.secondaryColor,
          "--accent": tokens.accentColor,
          "--primary-foreground": tokens.primaryForeground,
          "--secondary-foreground": tokens.secondaryForeground,
          "--accent-foreground": tokens.accentForeground,
          "--radius": tokens.radius,
          "--font-size-base": tokens.fontSizeBase,
          "--font-sans": fontVariable[tokens.fontFamily] ?? "var(--font-source-sans)",
        };
        Object.entries(pairs).forEach(([key, value]) => root.style.setProperty(key, value));
        document.body.classList.remove("button-outline", "button-soft");
        if (tokens.buttonStyle !== "solid") document.body.classList.add(`button-${tokens.buttonStyle}`);
        if (tokens.faviconUrl) {
          let icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
          if (!icon) {
            icon = document.createElement("link");
            icon.rel = "icon";
            document.head.appendChild(icon);
          }
          icon.href = tokens.faviconUrl;
        }
      })
      .catch(() => setTheme(null));
  }, []);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
