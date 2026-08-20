import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
  server: {
    port: 5173,
    // .ngrok-free.dev: temporary, for testing Xendit locally (it requires
    // an HTTPS success/cancel return URL) — remove once that's done.
    allowedHosts: ['.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-forms': ['react-hook-form'],
          'vendor-ui': ['@heroicons/react'],
        }
      }
    }
  }
});
