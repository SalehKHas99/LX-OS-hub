/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          300: '#5EEAD4', 400: '#2DD4BF', 500: '#14B8A6',
          600: '#0D9488', 700: '#0F766E', 800: '#115E59', 900: '#134E4A',
        },
        gold:   { 400: '#FBBF24', 500: '#F59E0B' },
        danger: { 400: '#F87171', 500: '#EF4444' },
      },
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body:    ['"Nunito"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'hero': ['clamp(2rem, 5vw, 3.5rem)', { lineHeight: '1.15', fontWeight: '700' }],
        'title': ['clamp(1.25rem, 2.5vw, 1.75rem)', { lineHeight: '1.3', fontWeight: '600' }],
      },
      backgroundImage: {
        'card-overlay': 'linear-gradient(to top, rgba(8,12,16,0.97) 0%, rgba(8,12,16,0.45) 55%, transparent 100%)',
      },
      animation: {
        'fade-in':  'fadeIn 0.35s ease forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
// appended
