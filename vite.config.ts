import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Every game's client entry is client/index.ts, so name its chunk after the game instead of "index"
const gameOf = (file: string | null | undefined) => file?.match(/games[\\/](\w+)[\\/]client[\\/]index\.ts$/)?.[1]

export default defineConfig({
  plugins: [react()],
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
