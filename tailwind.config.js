/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{vue,html,js}'],
  theme: {
    extend: {
      colors: {
        kotominer: {
          bg: '#0d0f14',
          card: '#13161e',
          elevated: '#1a1d28',
          violet: '#7c6af7',
          gold: '#f0c040',
          green: '#22c55e',
          red: '#ef4444',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
