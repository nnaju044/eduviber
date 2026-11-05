/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#0B0F19",
          slate: "#0F172A",
          surface: "#1E293B",
          gold: "#D97706",
          goldLight: "#F59E0B",
          goldDark: "#B45309",
        },
      },
    },
  },
  plugins: [],
}
