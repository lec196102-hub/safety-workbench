#!/usr/bin/env node
/**
 * build-pages.mjs
 * 为 GitHub Pages 构建产物：
 *   1. 推断 repo 名称（优先 REPO_NAME 环境变量，其次 package.json 的 name 字段）
 *   2. 设置 CLIENT_BASE_PATH（若已传入则尊重，否则用 /<repo-name>/）
 *   3. 调用 vite build，输出扁平产物到 dist/
 *   4. 复制 dist/index.html -> dist/404.html（GitHub Pages SPA 深链修复）
 *
 * 用法：
 *   - 本地预览 Pages 构建：REPO_NAME=my-repo npm run build:pages
 *   - CI（deploy.yml）会直接通过 CLIENT_BASE_PATH 注入真实 repo 名
 */
import { readFileSync, copyFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// 1. 推断 repo 名称
let repoName = process.env.REPO_NAME
if (!repoName) {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    repoName = pkg.name
  } catch (e) {
    console.error('[build-pages] 无法读取 package.json 的 name 字段，请设置 REPO_NAME 环境变量')
    process.exit(1)
  }
}

// 去除 npm scope（如 @scope/name）并清理首尾空白
repoName = String(repoName).replace(/^@[^/]+\//, '').trim()
if (!repoName) {
  console.error('[build-pages] 推断到的 repo 名称为空，请设置 REPO_NAME 环境变量')
  process.exit(1)
}

// 2. 设置 CLIENT_BASE_PATH：已传入则尊重，否则按 /<repo-name>/ 推断
const basePath = process.env.CLIENT_BASE_PATH || `/${repoName}/`
process.env.CLIENT_BASE_PATH = basePath

// 对齐 scripts/build.sh 的安全默认值，避免 preset 缺失环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.ASSETS_CDN_PATH = process.env.ASSETS_CDN_PATH || '/'

console.log(`[build-pages] repo name        = ${repoName}`)
console.log(`[build-pages] CLIENT_BASE_PATH = ${basePath}`)
console.log(`[build-pages] ASSETS_CDN_PATH  = ${process.env.ASSETS_CDN_PATH}`)

// 3. 调用 vite build -> dist/
const outDir = 'dist'
const buildResult = spawnSync(`npx vite build --outDir ${outDir} --emptyOutDir`, {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
  shell: true,
})
if (buildResult.status !== 0) {
  console.error('[build-pages] vite build 失败')
  process.exit(buildResult.status ?? 1)
}

// 4. 复制 dist/index.html -> dist/404.html
//    GitHub Pages 在深层路由返回 404.html 时，若 404.html 即为 SPA 入口，
//    前端路由会直接按当前 URL 渲染对应视图，无需额外重定向逻辑。
const indexHtml = resolve(root, outDir, 'index.html')
const notFoundHtml = resolve(root, outDir, '404.html')
if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, notFoundHtml)
  console.log('[build-pages] 已复制 dist/index.html -> dist/404.html')
} else {
  console.warn('[build-pages] 未找到 dist/index.html，跳过 404.html 生成')
}

console.log('[build-pages] 构建完成 -> dist/')
