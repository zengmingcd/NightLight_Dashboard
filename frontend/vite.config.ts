import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' }
  },
  build: {
    target: ['safari12', 'ios12'],
    cssTarget: ['safari12', 'ios12'],
    modulePreload: { polyfill: true }
  }
});
