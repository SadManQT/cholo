/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // doc 11-12 §2.1 "Rickshaw Modern" palette — defined once here so an
      // off-brand color is a compile-time impossibility, not a code-review nit.
      colors: {
        cholo: {
          50: '#E9F5F1', // selected-card wash, success backgrounds
          700: '#0E7A5F', // primary buttons, active tab, links, driver-online state
          800: '#0A5C48', // button hover/pressed
        },
        ink: {
          500: '#5A6B7A', // secondary text, captions
          900: '#0B1F2E', // headings, body text
        },
        marigold: {
          500: '#F5A623', // surge chips, star ratings, promo highlights
        },
        danger: {
          600: '#DC2626', // cancellations, SOS, destructive buttons
        },
        info: {
          600: '#2563EB', // assigned status, informational banners
        },
        surface: {
          DEFAULT: '#FFFFFF', // cards
          alt: '#F5F7F9', // app background
        },
        border: {
          DEFAULT: '#E3E8EE', // dividers
        },
      },
      // doc 11-12 §2.2 — one font-family declaration serves both scripts;
      // Noto Sans Bengali is the fallback, not a second stylesheet.
      fontFamily: {
        sans: ['Inter', '"Noto Sans Bengali"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
