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
      // 自己在 main.tsx 里注册，新版本装好后立刻刷新页面（否则要多刷新一次才看得到新版）
      injectRegister: false,
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
        // injectRegister: false 时插件不会自动打开这两个，新版本会一直"等待中"，要强制刷新才换：手动打开
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,glb}'],
        // Poly Haven 的模型和贴图很大，不预先缓存；第一次用到时再存下来
        // Q 版人物（*_toon.glb）也一样：只有切到 Q 版的人才下载
        globIgnores: ['models/ph/**', 'textures/**', 'models/people/*_toon.glb'],
        runtimeCaching: [{
          urlPattern: /\/(models\/ph|textures)\/|_toon\.glb$/,
          handler: 'CacheFirst',
          options: { cacheName: 'polyhaven-assets', expiration: { maxEntries: 120 } },
        }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
