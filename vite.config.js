import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    /**
     * Every built file at the top of `dist`, none of them under `dist/assets/`.
     *
     * Bloxity Legion's static hosting (a DigitalOcean Spaces bucket, from the
     * response headers) only makes the *top-level* files of an uploaded build
     * public - `index.html` came back 200, but everything one folder down
     * (`assets/index-*.js`, `fonts/*`) came back 403 AccessDenied. Re-uploading the
     * same zip changed nothing, which is what you'd expect from a bucket ACL that
     * is applied per top-level object rather than recursively.
     *
     * There is no dashboard fix for that from our side, so the build itself no
     * longer has anything below the top level to trip it. This costs nothing on
     * Netlify, which never cared about the folder layout to begin with.
     */
    assetsDir: '',
  },
})
