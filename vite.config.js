import { defineConfig } from 'vite'

const repoName = 'simple-3d-shooter'

export default defineConfig({
  // GitHub Pages project sites are hosted under /<repo>/.
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/',
})
