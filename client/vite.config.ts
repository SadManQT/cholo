import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On Vercel the browser calls the API as /api/v1 on the site itself and vercel.json forwards it to Render.
// Same-site requests keep the sign-in cookie first-party, which browsers that block third-party cookies
// (Safari, Chrome incognito) would otherwise drop, signing people out after any full page load.
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SAME_ORIGIN_API': JSON.stringify(process.env.VERCEL ? '/api/v1' : ''),
  },
})
