import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    hmr: process.env.REPLIT_DEV_DOMAIN
      ? {
          host: process.env.REPLIT_DEV_DOMAIN,
          clientPort: 443,
          protocol: 'wss',
        }
      : true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
