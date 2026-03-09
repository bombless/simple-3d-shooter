import { defineConfig } from 'vite'

const repoName = 'simple-3d-shooter'

export default defineConfig({
  // GitHub Pages project sites are hosted under /<repo>/.
  // Android WebView (Capacitor) needs relative asset paths in production build.
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : './',
})
