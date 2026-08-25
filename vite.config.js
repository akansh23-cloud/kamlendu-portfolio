import { defineConfig } from 'vite';

/**
 * Build configuration.
 *
 * The only non-default decision here is splitting three.js into its own chunk.
 * The renderer is ~600 kB of the bundle and it never changes; the site's own
 * code is small and changes constantly. Keeping them apart means every future
 * edit to a scene invalidates roughly 40 kB of cache instead of all of it.
 *
 * `base: './'` keeps the build portable — it will run from a domain root, from
 * a subdirectory, or straight off the filesystem, which matters when the thing
 * gets emailed to someone as a zip.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
});
