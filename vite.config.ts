/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '重生末日之前',
        short_name: '末日之前',
        description: '女主重生到丧尸末日前，囤货、建基地、谈恋爱活下去。',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        lang: 'zh-CN',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,glb}'],
        // Poly Haven 的模型和贴图很大，不预先缓存；第一次用到时再存下来
        globIgnores: ['models/ph/**', 'textures/**'],
        runtimeCaching: [{
          urlPattern: /\/(models\/ph|textures)\//,
          handler: 'CacheFirst',
          options: { cacheName: 'polyhaven-assets', expiration: { maxEntries: 120 } },
        }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
