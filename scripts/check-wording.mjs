#!/usr/bin/env node
/* 文案红线：不诊断、不处置、不判读、不评价患者。
 * 仅独立注释行不作为渲染文案扫描；任意行尾标记不得豁免整行。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const BANNED = [
  '建议治疗', '可以停药', '无需就医', '治愈率', '建议复查', '推荐方案', '生存率',
  '预后良好', '可能复发', '依从性差', '无需治疗', '不必就医',
]
// 判读类词单独处理：允许出现在"禁止清单/说明句"里，但不得出现在渲染文案中
const JUDGE = ['偏高', '偏低', '异常值', '达标', '不达标']
const errors = []
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'release', 'guidebooks', 'docs'].includes(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (['.js', '.mjs', '.html', '.css'].includes(extname(name))) files.push(p)
  }
}
for (const d of ['dsh', 'lib', 'public', 'prototypes', 'src', 'demo']) {
  try { walk(join(ROOT, d)) } catch { /* 跳过 */ }
}
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  text.split('\n').forEach((line, i) => {
    if (/^\s*(?:\/\/|\/\*|\*|<!--)/.test(line)) return
    for (const w of BANNED) if (line.includes(w)) errors.push(`${f.replace(ROOT + '/', '')}:${i + 1} 禁用词「${w}」`)
    for (const w of JUDGE) if (line.includes(w) && !/不得|禁止|不出现|不许|写成|避免/.test(line)) {
      errors.push(`${f.replace(ROOT + '/', '')}:${i + 1} 判读词「${w}」`)
    }
  })
}
console.log(JSON.stringify({ files: files.length, errors }, null, 2))
process.exit(errors.length ? 1 : 0)
