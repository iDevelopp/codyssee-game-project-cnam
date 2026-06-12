import { defineConfig } from 'vite';

/**
 * Vite configuration for Codyssey Web.
 *
 * base: '/codyssee/' — deployed as a sub-path on ohvenus.fr/codyssee (ADR-004).
 * All asset URLs are relative to this base at build time.
 */
export default defineConfig({
  base: '/codyssee/',

  build: {
    // Output directory for nginx static serving
    outDir: 'dist',
    emptyOutDir: true,
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
