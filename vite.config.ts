import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const resolveHtml = (name: string): string => fileURLToPath(new URL(name, import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolveHtml('index.html'),
        cache: resolveHtml('cache.html')
      }
    }
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 404.html is served by GitHub Pages only; precaching it would let the
        // recovery page answer navigations and create a redirect loop.
        globIgnores: ['**/404.html']
      },
      devOptions: { enabled: false }
    })
  ]
})
