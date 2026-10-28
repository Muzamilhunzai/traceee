/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8b5cf6', // Soft purple
          50:  '#f5f3ff',
          100: '#ede9fe',
          600: '#8b5cf6',
          700: '#7c3aed',
        },
        softbg: '#F8F9FC',
        softcard: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(139, 92, 246, 0.05), 0 2px 10px -2px rgba(0, 0, 0, 0.02)',
        float: '0 10px 40px -10px rgba(139, 92, 246, 0.15)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
};