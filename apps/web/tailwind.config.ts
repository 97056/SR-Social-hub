import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--background)",
        surface: "var(--surface)",
        ink: "var(--text)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        accent: "var(--accent)",
        "primary-foreground": "var(--primary-foreground)",
        "accent-foreground": "var(--accent-foreground)",
      },
      borderRadius: {
        brand: "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
