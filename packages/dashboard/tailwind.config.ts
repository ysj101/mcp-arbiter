import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'court-navy': '#0f1d3a',
        'court-navy-dark': '#0a142a',
        'court-gold': '#c9a227',
        'court-gold-soft': '#e5c76b',
        'court-ivory': '#f6f1e4',
        'court-parchment': '#ece4cf',
      },
      fontFamily: {
        'court-serif': ['Noto Serif JP', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
