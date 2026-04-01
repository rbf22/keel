import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/agent-system*.test.ts' // Exclude Puppeteer tests from main suite
    ]
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
})
