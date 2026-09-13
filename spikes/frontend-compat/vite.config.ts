import { defineConfig } from 'vite';

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(new Date().toISOString()) },
  build: {
    target: ['safari12', 'ios12'],
    cssTarget: ['safari12', 'ios12'],
    sourcemap: true,
    modulePreload: { polyfill: true }
  }
});
