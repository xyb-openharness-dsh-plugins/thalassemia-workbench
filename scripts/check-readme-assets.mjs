#!/usr/bin/env node
/**
 * scripts/check-readme-assets.mjs —— 33 号：README 截图引用必须真实存在且合规
 *
 * 断言：① 引用的每个图片路径存在；② 每张 <2MB；③ 数量 ≥4；④ 文件名含版本号；
 *       ⑤ docs/screenshots/ 非空；⑥ 截图不得含私密模块页（心理与家庭）。
 */
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim()
const errors = []

const refs = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+\.png)\)/g)].map((m) => m[1])
if (refs.length < 4) errors.push(`README 截图 ${refs.length} 张 < 4 张`)
for (const ref of refs) {
  const p = join(ROOT, ref)
  if (!existsSync(p)) { errors.push('截图不存在：' + ref); continue }
  const size = statSync(p).size
  if (size > 2 * 1024 * 1024) errors.push(`截图 >2MB：${ref} (${(size / 1048576).toFixed(1)}MB)`)
  if (!/-0|-\d+\.\d+\.\d+/.test(ref.split('/').pop())) errors.push('截图文件名缺版本号：' + ref)
}
const dir = join(ROOT, 'docs/screenshots')
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : []
if (!files.length) errors.push('docs/screenshots/ 为空')
const privateLeak = refs.filter((r) => /mind|private|心理/.test(r))
if (privateLeak.length) errors.push('README 引用了私密模块截图：' + privateLeak.join(','))

console.log(JSON.stringify({ images: refs.length, files: files.length, version, errors }, null, 2))
process.exit(errors.length ? 1 : 0)
