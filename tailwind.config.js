/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-stencil)", "Impact", "sans-serif"],
        stencil: ["var(--font-stencil)", "Impact", "sans-serif"],
      },
      colors: {
        // Canvas / crate (was: paper)
        paper: {
          DEFAULT: "#e6d9ae",
          50: "#f4ead0",
          100: "#f0e4c2",
          200: "#e6d9ae",
          300: "#ded0a1",
          400: "#cfbd7e",
          500: "#b8a765",
        },
        canvas: {
          DEFAULT: "#e6d9ae",
          soft: "#ded0a1",
          deep: "#cfbd7e",
          parchment: "#f2e8c4",
        },
        // Steel / ink
        ink: {
          DEFAULT: "#1f1c17",
          muted: "#3a3630",
          soft: "#7a7362",
        },
        steel: {
          DEFAULT: "#1f1c17",
          soft: "#3a3630",
          deep: "#14120e",
        },
        rivet: {
          DEFAULT: "#7a7362",
          soft: "#a6997a",
        },
        // Olive drab family
        od: {
          DEFAULT: "#3e4c28",
          deep: "#2d3820",
          mid: "#5a6d3c",
          bright: "#8a9a5f",
        },
        // Safety / hazard
        safety: {
          DEFAULT: "#e85d1f",
          deep: "#b24011",
        },
        hazard: {
          DEFAULT: "#f0c41c",
          deep: "#b58a0e",
        },
        blueprint: {
          DEFAULT: "#1b3a5c",
        },
        classified: {
          DEFAULT: "#b2331c",
        },
        // Legacy aliases used across the codebase
        rule: {
          DEFAULT: "#7a7362",
          soft: "#a6997a",
        },
        stamp: {
          DEFAULT: "#e85d1f",
          soft: "#b24011",
        },
        field: {
          DEFAULT: "#3e4c28",
        },
        warn: {
          DEFAULT: "#b58a0e",
        },
        accent: {
          DEFAULT: "#1b3a5c",
        },
      },
      letterSpacing: {
        mono: "0.18em",
        stencil: "0.22em",
      },
    },
  },
  darkMode: "class",
  plugins: [],
};
