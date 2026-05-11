// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    css: {
      // Use Lightning CSS for transformation + minification: faster and more
      // aggressive than esbuild (drops unused @keyframes, merges rules,
      // shortens colors, removes whitespace + comments).
      transformer: "lightningcss",
      lightningcss: {
        targets: {
          // Modern evergreen browsers — allows shorter output (no legacy prefixes).
          chrome: 110 << 16,
          firefox: 110 << 16,
          safari: 16 << 16,
          edge: 110 << 16,
        },
        drafts: { customMedia: true },
      },
    },
    build: {
      cssMinify: "lightningcss",
      cssCodeSplit: true,
      // Inline tiny CSS-referenced assets to avoid extra requests.
      assetsInlineLimit: 4096,
      reportCompressedSize: false,
    },
    plugins: [
      // PWA / Service Worker — cacheia o shell e assets para revisitas mais
      // rápidas. Desativado em dev e em previews/iframes (registro guardado
      // em src/components/PwaRegister.tsx).
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false, // registramos manualmente com guardas anti-iframe/preview
        devOptions: { enabled: false },
        includeAssets: [
          "favicon.ico",
          "favicon-32.png",
          "apple-touch-icon.png",
          "icon-192.png",
          "icon-512.png",
          "maskable-icon-512.png",
        ],
        manifest: false, // já existe public/manifest.webmanifest
        workbox: {
          // Não interceptar rotas internas/SSR sensíveis.
          navigateFallback: "/",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/~oauth/,
            /^\/_server/,
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ["**/*.{js,css,html,svg,png,webp,ico,woff2}"],
          runtimeCaching: [
            {
              // HTML sempre via rede primeiro — evita servir shell antigo
              // após um deploy novo.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Fontes self-hosted: cache longo, imutável.
              urlPattern: ({ url }) => url.pathname.startsWith("/fonts/"),
              handler: "CacheFirst",
              options: {
                cacheName: "fonts",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Imagens estáticas.
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Bundles JS/CSS (hashados pelo Vite — seguro cache longo).
              urlPattern: ({ request }) =>
                request.destination === "script" || request.destination === "style",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-resources",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
