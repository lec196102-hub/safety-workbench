import path from 'path'
import { defineConfig } from '@lark-apaas/coding-preset-vite-react'

export default defineConfig({
  // GitHub Pages 项目站点需要按 /<repo-name>/ 部署，base 由构建脚本注入；
  // 默认 '/' 用于本地开发与根站点部署。
  base: process.env.CLIENT_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
