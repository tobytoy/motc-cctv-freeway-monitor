import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-leaflet': ['leaflet', 'leaflet.markercluster'],
          'vendor-hls': ['hls.js'],
          'vendor-ui': ['lucide-react'],
          'vendor-xml': ['fast-xml-parser'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
