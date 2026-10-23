import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Um HTML só, com JS, CSS e fontes embutidos: o app carrega como string na WebView.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
})
