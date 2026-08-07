import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import sitemap from 'vite-plugin-sitemap'

const API_PROXY_TARGET = 'https://api.void-rp.ru'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    sitemap({
      hostname: 'https://void-rp.ru',
      dynamicRoutes: [
        '/guide',
        '/recipes',
        '/market',
        '/nations',
        '/nations/rankings',
        '/alliances',
        '/leaderboard',
        '/players/top',
        '/shop',
        '/download-launcher',
        '/register',
        '/login',
        '/links',
        '/privacy',
        '/offer',
      ],
      exclude: [
        '/admin',
        '/admin/**',
        '/internal-admin',
        '/internal-admin/**',
        '/profile',
        '/profile/**',
        '/nation/studio',
      ],
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date(),
    }),
  ],
  build: {
    // Немного поднимаем порог предупреждения — после code-splitting отдельные
    // чанки крупных вьюх (гайд, рынок) всё ещё могут превышать дефолтные 500 KB.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Выносим стабильные библиотеки в отдельный vendor-чанк: он редко
        // меняется и хорошо кэшируется между релизами приложения.
        manualChunks: {
          vendor: ['vue', 'vue-router', 'vue-i18n', 'nprogress'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    allowedHosts: ['minecraftrating.ru', '127.0.0.1', '0.0.0.0'],
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
      },
      '/media': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
