import path from 'path';
import { defineConfig } from 'vite';

// Standalone build — no API keys, no AI Studio. `base: './'` keeps asset paths
// relative so the built site works from any static host (GitHub Pages project
// sites, Netlify, a plain file server, etc.).
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
