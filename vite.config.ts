/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 配信パス。GitHub Pages（プロジェクトサイト）は /<リポジトリ名>/ 配下に置かれるため、
// Pages のビルドだけ VITE_BASE で上書きする。未指定は '/'（Cloudflare・ローカル開発）。
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
