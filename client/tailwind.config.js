export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cholo: {
          50: '#E9F5F1',
          700: '#0E7A5F',
          800: '#0A5C48',
        },
        ink: {
          500: '#5A6B7A',
          900: '#0B1F2E',
        },
        marigold: {
          500: '#F5A623',
        },
        danger: {
          600: '#DC2626',
        },
        info: {
          600: '#2563EB',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F7F9',
        },
        border: {
          DEFAULT: '#E3E8EE',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Bengali"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        'cholo-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'cholo-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'cholo-drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
