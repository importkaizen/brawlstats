import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        gold: {
          DEFAULT: "#E8C86A",
          50: "#FFFBEA",
          100: "#FFF3C4",
          200: "#FCE588",
          300: "#FADB5F",
          400: "#F7C948",
          500: "#FFD700",
          600: "#E5B800",
          700: "#B38600",
        },
        accent: {
          DEFAULT: "#A78BFA",
          purple: "#A78BFA",
          teal: "#22D3EE",
          rose: "#F472B6",
        },
        rank: {
          bronze: "#CD853F",
          silver: "#B8C4CE",
          gold: "#FFC936",
          diamond: "#29C4FF",
          mythic: "#B749FF",
          legendary: "#FF4B4B",
          masters: "#FF9F2E",
          pro: "#34EBBA",
        },
        win: "#82C9A2",
        loss: "#F18484",
        draw: "#94A3B8",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 215, 0, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
