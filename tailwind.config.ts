import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Martial arts-inspired high-contrast palette
        belt: {
          black: "#0a0a0a",
          dark: "#141414",
          gray: "#1f1f1f",
          red: "#dc2626",
          blue: "#2563eb",
          gold: "#f59e0b",
          white: "#f5f5f5",
        },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
