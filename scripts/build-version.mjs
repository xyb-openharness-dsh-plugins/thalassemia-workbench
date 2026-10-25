#!/usr/bin/env node
/* 生成 lib/version.js（版本唯一源是 package.json 的 version；构建日取 VERSION 文件里的日期或今天）。
 *   node scripts/build-version.mjs           写入
 *   node scripts/build-version.mjs --check   只校验
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const build = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10)
const channel = pkg.version.includes('-') ? 'preview' : 'dev'
const label = { dev: '开发版', preview: '预览版' }[channel]
const out = `/* 生成物：不要手改。源是 package.json + 构建日，见 scripts/build-version.mjs */
export const version = ${JSON.stringify(pkg.version)}
export const build = ${JSON.stringify(build)}
export const channel = ${JSON.stringify(channel)}
export const channelLabel = ${JSON.stringify(label)}
`
const target = join(ROOT, 'lib/version.js')
const check = process.argv.includes('--check')
if (check) {
  const prev = readFileSync(target, 'utf8')
  const sameVersion = prev.includes(`version = ${JSON.stringify(pkg.version)}`)
  if (!sameVersion) { console.error('✗ lib/version.js 版本与 package.json 不一致'); process.exit(1) }
  console.log('version 一致：' + pkg.version)
} else {
  writeFileSync(target, out)
  console.log('version 已生成：' + pkg.version)
}
