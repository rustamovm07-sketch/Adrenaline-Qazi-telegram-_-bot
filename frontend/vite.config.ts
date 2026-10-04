import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/shop/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: ['protocols-part-horizontal-natural.trycloudflare.com'],
    proxy: {
      '^/(auth|payments|products|categories|customers|orders|dashboard|inventory|store-settings|uploads|health)(/|$)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}))
