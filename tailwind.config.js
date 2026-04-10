/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        "loading": "loading 2s ease-in-out infinite",
      },
      keyframes: {
        "loading": {
          "0%": { width: "0%" },
          "50%": { width: "100%" },
          "100%": { width: "0%" },
        },
      },
    },
  },
  plugins: [],
}
