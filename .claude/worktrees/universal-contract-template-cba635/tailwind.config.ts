import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-literata)", "Georgia", "serif"],
        body: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "var(--color-ink)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
        },
        accent: "var(--color-accent)",
        surface: {
          DEFAULT: "var(--color-surface)",
          soft: "var(--color-surface-soft)",
        },
        muted: "var(--color-text-muted)",
      },
      borderRadius: {
        brand: "var(--radius-md)",
      },
    },
  },
  plugins: [],
};

export default config;
