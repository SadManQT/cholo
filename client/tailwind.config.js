const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cholo: {
          50: token('cholo-50'),
          700: token('cholo-700'),
          800: token('cholo-800'),
        },
        ink: {
          500: token('ink-500'),
          900: token('ink-900'),
        },
        marigold: {
          500: token('marigold-500'),
        },
        gold: {
          300: token('gold-300'),
          400: token('gold-400'),
          600: token('gold-600'),
        },
        danger: {
          600: token('danger-600'),
        },
        info: {
          600: token('info-600'),
        },
        surface: {
          DEFAULT: token('surface'),
          alt: token('surface-alt'),
        },
        border: {
          DEFAULT: token('border'),
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
