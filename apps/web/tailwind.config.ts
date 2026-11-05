import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          bg: "var(--bg)",
          sidebar: "var(--sidebar)",
          card: "var(--card)",
          elevated: "var(--elevated)",
        },
        brand: {
          primary: "#00D2FF",
          secondary: "#C026FF",
          success: "#3DDC97",
          warning: "#F0C14A",
          error: "#FF6B6B",
        },
        content: {
          DEFAULT: "var(--text)",
          muted: "var(--muted)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        panel: "var(--shadow, 0 1px 0 rgba(255,255,255,0.04), 0 18px 40px rgba(0,0,0,0.35))",
      },
      backgroundImage: {
        "mesh-ink":
          "radial-gradient(ellipse 70% 45% at 0% -10%, rgba(0,210,255,0.16), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 0%, rgba(192,38,255,0.14), transparent 50%)",
      },
    },
  },
  plugins: [],
};

export default config;
