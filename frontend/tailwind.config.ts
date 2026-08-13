import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          canvas: "var(--app-canvas)",
          surface: "var(--app-surface)",
          soft: "var(--app-surface-soft)",
          tint: "var(--app-surface-tint)",
          ink: "var(--app-ink)",
          muted: "var(--app-muted)",
          primary: "var(--app-primary)",
          "primary-hover": "var(--app-primary-hover)",
          accent: "var(--app-accent)",
          "accent-muted": "var(--app-accent-muted)",
          border: "var(--app-border)",
        },
      },
      fontFamily: {
        display: [
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
