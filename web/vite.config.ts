import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Vite configuration for Codyssey Web.
 *
 * base: '/codyssee/' — deployed as a sub-path on ohvenus.fr/codyssee (ADR-004).
 * All asset URLs are relative to this base at build time.
 *
 * resolve.alias: maps the '@/' TypeScript path alias (tsconfig.json `paths`)
 * to Vite/Rollup so @/ imports work at bundle time, not just during type-checking.
 * Uses new URL + import.meta.url (ESM-native) instead of __dirname to avoid
 * requiring @types/node in the devDependencies.
 *
 * viteStaticCopy: the data-driven game content lives in `web/content/` (the
 * documented, engine-agnostic edit location — ADR-002). Vite only copies
 * `public/` into the build, so without this the runtime fetch of
 * `${BASE_URL}content/*.json` returns the SPA index.html on a production build
 * and the game breaks (QA BUG-01). This copies `content/` → `dist/content/`.
 */
export default defineConfig({
  base: '/codyssee/',

  plugins: [
    viteStaticCopy({
      targets: [{ src: 'content', dest: '.' }],
    }),
  ],

  resolve: {
    alias: {
      // Must match tsconfig.json "paths": { "@/*": ["src/*"] }
      '@': new URL('./src', import.meta.url).pathname,
    },
  },

  build: {
    // Output directory for nginx static serving
    outDir: 'dist',
    emptyOutDir: true,

    rollupOptions: {
      output: {
        /**
         * Split Phaser into its own vendor chunk so the browser can cache it
         * independently of game-logic changes (TASK-026 perf — OBS bundle).
         *
         * Strategy: any module whose resolved id includes 'phaser' goes into
         * 'vendor-phaser'. Game code and content-loader live in the default
         * 'index' chunk. This cuts the single-chunk 500 kB warning because
         * Rollup will warn per-chunk, and the game-logic chunk is much smaller.
         *
         * Cache benefit: after a code change only the game chunk is re-downloaded;
         * the ~800 kB Phaser chunk stays cached in the browser.
         */
        manualChunks(id: string): string | undefined {
          if (id.includes('phaser')) {
            return 'vendor-phaser';
          }
          return undefined;
        },
      },
    },
  },

  server: {
    // Dev server port — local only, no deployment
    port: 5173,
    strictPort: false,
  },

  preview: {
    port: 4173,
    strictPort: false,
  },
});
