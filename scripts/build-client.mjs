#!/usr/bin/env node
/* 生成 lib/client.js：把来源常量注入 src/client.js（官方要求"已构建好的单文件"）。
 * 参数来源唯一：package.json（name/repository/description）、lib/identity.js（API/UI 前缀）、
 * lib/layout.js（面板）、VERSION（版本）、lib/version.js（构建日）。
 *   node scripts/build-client.mjs          写入（内容没变不落盘）
 *   node scripts/build-client.mjs --check  只校验，不一致退出码 1
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const { API_PREFIX, UI_ENTRY } = await import('../lib/identity.js')
const { AGENT_PANE, PANEL, assertPanelConfig } = await import('../lib/layout.js')
const { version, build } = await import('../lib/version.js')

const problems = assertPanelConfig(PANEL, AGENT_PANE)
if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(String(pkg.repository?.url || ''))) {
  problems.push('package.json repository 必须是 https://github.com/<owner>/<repo>')
}
if (problems.length) { problems.forEach((p) => console.error('✗ ' + p)); process.exit(1) }

const src = readFileSync(join(ROOT, 'src/client.js'), 'utf8')
const map = {
  __PKG_NAME__: JSON.stringify(pkg.name),
  __TITLE__: JSON.stringify(pkg.dshTitle || '小铁宝 FerroPal · 重型地中海贫血工作台'),
  __DESCRIPTION__: JSON.stringify(pkg.description || ''),
  __VERSION__: JSON.stringify(version),
  __BUILD__: JSON.stringify(build),
  __API_PREFIX__: JSON.stringify(API_PREFIX),
  __UI_ENTRY__: JSON.stringify(UI_ENTRY),
  __REPOSITORY__: JSON.stringify(pkg.repository.url.replace(/\.git$/, '')),
  __AGENT_PANE__: JSON.stringify(AGENT_PANE),
}
let out = src
for (const [k, v] of Object.entries(map)) out = out.split(k).join(v)
if (/__[A-Z_]+__/.test(out)) { console.error('✗ 仍有未替换的占位符：' + out.match(/__[A-Z_]+__/g).slice(0, 3)); process.exit(1) }

const target = join(ROOT, 'lib/client.js')
const check = process.argv.includes('--check')
if (check) {
  const prev = existsSync(target) ? readFileSync(target, 'utf8') : ''
  if (prev !== out) { console.error('✗ lib/client.js 与来源不一致，跑 `npm run build:client`'); process.exit(1) }
  console.log('client 一致（' + out.length + ' 字节）')
} else {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== out) writeFileSync(target, out)
  console.log('client 已生成（' + out.length + ' 字节）')
}
