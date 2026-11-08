import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Every game's client entry is client/index.ts, so name its chunk after the game instead of "index"
const gameOf = (file: string | null | undefined) => file?.match(/games[\\/](\w+)[\\/]client[\\/]index\.ts$/)?.[1]

// The game server is chosen by the player (Settings or a ?server= link) and its SVGs are inlined, so a hostile server
// could send onload= or javascript: markup. This policy refuses every inline script except index.html's own, by hash;
// Rapier (Block Tower) compiles WebAssembly. Build only, since Vite's dev server injects inline scripts of its own.
function scriptPolicy(): Plugin {
  return {
    name: 'script-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
          // The browser hashes the script with its line endings made \n, as a Windows checkout's \r\n are not
          .map(([, code]) => `'sha256-${createHash('sha256').update(code.replace(/\r\n?/g, '\n')).digest('base64')}'`)
        const policy = ["script-src 'self' 'wasm-unsafe-eval'", ...hashes].join(' ')
        return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), scriptPolicy()],
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: chunk => `assets/${gameOf(chunk.facadeModuleId) ?? '[name]'}-[hash].js`,
        assetFileNames: asset => `assets/${asset.originalFileNames.map(gameOf).find(Boolean) ?? '[name]'}-[hash][extname]`
      }
    }
  }
})
