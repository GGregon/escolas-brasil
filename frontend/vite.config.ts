import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: 'runtime-data-only',
    apply: 'build',
    closeBundle() {
      const catalog = resolve(root, '../docs/dados-release.json')
      if (!existsSync(catalog)) throw new Error('Catálogo de dados ausente.')
      const files = JSON.parse(readFileSync(catalog, 'utf8')).files as { path: string }[]
      for (const { path } of files) {
        const source = resolve(root, 'public/data', path)
        if (!existsSync(source)) throw new Error('Instale os dados antes do build: python scripts/baixar_dados.py, na raiz do projeto.')
        const destination = resolve(root, 'dist/data', path)
        mkdirSync(dirname(destination), { recursive: true })
        copyFileSync(source, destination)
      }
      copyFileSync(resolve(root, 'public/creditos.txt'), resolve(root, 'dist/creditos.txt'))
    },
  }],
  publicDir: command === 'build' ? false : 'public',
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { chunkSizeWarningLimit: 1600 },
}))
