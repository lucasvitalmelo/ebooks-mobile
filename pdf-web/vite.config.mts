import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Um HTML só (como o reader-web), carregado como string numa WebView escondida.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000_000, target: 'es2022' },
})
