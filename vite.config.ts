import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves this project site under /<repository>/.
  base: '/unicity-sphere-nft/',
  plugins: [react(), tailwindcss()],
  build: {
    // Keep every asset a real file: the dApp icon URL is sent to the wallet in the
    // Connect handshake, and a short hosted URL beats a data: URI there.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
