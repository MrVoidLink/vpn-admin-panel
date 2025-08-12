import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ✨ توجه: اگر دامنه‌ی Vercel شما فرق داره، این URL رو عوض کن
const VERCEL_URL = 'https://vpn-admin-panel-chi.vercel.app'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: VERCEL_URL,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
