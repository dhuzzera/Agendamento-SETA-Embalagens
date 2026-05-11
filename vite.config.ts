// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
  },
});
