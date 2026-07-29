import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Electron loads the built files from disk (file://), so assets must use
// relative paths rather than absolute ones — hence base: './'.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
