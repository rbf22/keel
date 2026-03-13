import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/keel/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Keel - PadAgent Core',
        short_name: 'Keel',
        description: 'Local-First Agentic Framework for iPadOS',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        display: 'standalone',
        background_color: '#ffffff',
        start_url: './index.html',
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
      }
    })
  ],
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  }
});
