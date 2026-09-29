import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SAME_ORIGIN_API': JSON.stringify(process.env.VERCEL ? '/api/v1' : ''),
  },
})
