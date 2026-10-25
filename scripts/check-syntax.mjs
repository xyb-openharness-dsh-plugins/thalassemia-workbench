#!/usr/bin/env node
/* 语法与"生成器不碰磁盘"检查：所有运行期 .js/.mjs 过 node --check；
 * demo 生成器被 import 时不得写文件（唯一源必须可被安全 import）。
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const errors = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'release', 'guidebooks'].includes(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (['.js', '.mjs'].includes(extname(name))) {
      try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }) }
      catch (e) { errors.push(p.replace(ROOT + '/', '') + '：' + String(e.stderr || e.message).split('\n')[0]) }
    }
  }
}
for (const d of ['dsh', 'lib', 'public', 'scripts', 'src', 'demo', 'test']) {
  try { walk(join(ROOT, d)) } catch { /* 目录不存在则跳过 */ }
}

// 生成器 import 副作用：import 后不应新增文件
const before = new Set(readdirSync(join(ROOT, 'demo')))
try {
  const mod = await import('../demo/build-demo-data.mjs')
  if (typeof mod.buildDemoProfiles !== 'function') errors.push('demo 生成器没有导出 buildDemoProfiles()')
  const b = mod.buildDemoProfiles()
  if (!b.profiles || !b.profiles.A) errors.push('buildDemoProfiles() 返回结构不对')
} catch (e) { errors.push('import demo 生成器失败：' + e.message) }
const after = new Set(readdirSync(join(ROOT, 'demo')))
for (const f of after) if (!before.has(f)) errors.push('import demo 生成器时写了文件：' + f)

console.log(JSON.stringify({ errors }, null, 2))
process.exit(errors.length ? 1 : 0)
