/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#082f49',
        },
        success: {
          500: '#22c55e',
          900: '#14532d',
        },
        danger: {
          500: '#ef4444',
          900: '#7f1d1d',
        },
        warning: {
          500: '#f59e0b',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 10px 30px -15px rgba(8, 47, 73, 0.2)',
      },
      transitionDuration: {
        200: '200ms',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [],
}
