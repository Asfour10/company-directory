/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dynamic brand colors using CSS custom properties
        primary: {
          50: 'var(--color-primary-50, rgb(239 246 255))',
          100: 'var(--color-primary-100, rgb(219 234 254))',
          200: 'var(--color-primary-200, rgb(191 219 254))',
          300: 'var(--color-primary-300, rgb(147 197 253))',
          400: 'var(--color-primary-400, rgb(96 165 250))',
          500: 'var(--color-primary, rgb(59 130 246))',
          600: 'var(--color-primary-600, rgb(37 99 235))',
          700: 'var(--color-primary-700, rgb(29 78 216))',
          800: 'var(--color-primary-800, rgb(30 64 175))',
          900: 'var(--color-primary-900, rgb(30 58 138))',
        },
        accent: {
          50: 'var(--color-accent-50, rgb(236 253 245))',
          100: 'var(--color-accent-100, rgb(209 250 229))',
          200: 'var(--color-accent-200, rgb(167 243 208))',
          300: 'var(--color-accent-300, rgb(110 231 183))',
          400: 'var(--color-accent-400, rgb(52 211 153))',
          500: 'var(--color-accent, rgb(16 185 129))',
          600: 'var(--color-accent-600, rgb(5 150 105))',
          700: 'var(--color-accent-700, rgb(4 120 87))',
          800: 'var(--color-accent-800, rgb(6 95 70))',
          900: 'var(--color-accent-900, rgb(6 78 59))',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  // Enable arbitrary value support for dynamic colors
  safelist: [
    {
      pattern: /bg-\[#[0-9a-fA-F]{6}\]/,
    },
    {
      pattern: /text-\[#[0-9a-fA-F]{6}\]/,
    },
    {
      pattern: /border-\[#[0-9a-fA-F]{6}\]/,
    },
    {
      pattern: /hover:bg-\[#[0-9a-fA-F]{6}\]/,
    },
    {
      pattern: /hover:text-\[#[0-9a-fA-F]{6}\]/,
    },
  ],
};
