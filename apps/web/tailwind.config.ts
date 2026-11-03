import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: "#080D19",
          sidebar: "#0B1220",
          card: "#111A2B",
          elevated: "#162136",
        },
        brand: {
          primary: "#7565FF",
          secondary: "#22D3EE",
          success: "#34D399",
          warning: "#FBBF24",
          error: "#FB7185",
        },
        content: {
          DEFAULT: "#F8FAFC",
          muted: "#94A3B8",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Segoe UI", "sans-serif"],
        display: ["var(--font-sora)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        panel: "0 10px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
