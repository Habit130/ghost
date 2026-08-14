import { defineConfig } from 'vite'

// Relative asset paths so the build works under the GitHub Pages subpath (/ghost/)
// as well as at any preview host.
export default defineConfig({
  base: './',
})
