import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5847, host: '0.0.0.0', strictPort: true,
    // Same-origin API in dev, like the single-container deploy (server/ listens on 3100)
    proxy: { '/api': process.env.API_PROXY || 'http://127.0.0.1:3100' },
  },
  preview: { port: 4173, host: '0.0.0.0' },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
})
