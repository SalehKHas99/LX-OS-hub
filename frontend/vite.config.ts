/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function devBanner() {
  return {
    name: 'lxos-dev-banner',
    configureServer() {
      return () => {
        console.log('')
        console.log('  \x1b[32m▶ LX-OS dev server\x1b[0m — Profiles & Messages are in THIS bundle.')
        console.log('  \x1b[90m  Open the URL below. Do NOT use "npm run preview" or dist/ for latest code.\x1b[0m')
        console.log('')
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), devBanner()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react', 'clsx', 'react-hot-toast', 'react-dropzone'],
          'vendor-state': ['zustand'],
          'vendor-http': ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { overlay: true },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
