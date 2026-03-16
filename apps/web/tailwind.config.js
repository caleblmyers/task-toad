/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: 'var(--brand-green)',
          lime: 'var(--brand-lime)',
          dark: 'var(--brand-dark)',
          cyan: 'var(--brand-cyan)',
          'green-light': 'var(--brand-green-light)',
          'green-hover': 'var(--brand-green-hover)',
        },
        status: {
          todo: '#94a3b8',        // slate-400
          'in-progress': '#3b82f6', // blue-500
          done: '#22c55e',        // green-500
        },
        priority: {
          critical: '#ef4444',    // red-500
          high: '#f97316',        // orange-500
          medium: '#3b82f6',      // blue-500
          low: '#94a3b8',         // slate-400
        },
      },
      animation: {
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-up': 'slideInUp 0.15s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
