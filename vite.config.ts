import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split PDF.js into its own chunk (large library)
          pdfjs: ['pdfjs-dist'],
          // Core vendor dependencies
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'jszip', 'idb-keyval'],
        }
      }
    },
    // Increase chunk size warning limit for PDF.js
    chunkSizeWarningLimit: 1000,
  }
})
