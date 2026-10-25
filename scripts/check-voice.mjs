#!/usr/bin/env node
/**
 * scripts/check-voice.mjs —— 患者视角红线断言（一条红线：每条功能线挂一句患者原话）
 *
 * 断言：
 *  V1 13 条一级功能线各有一句原话（页数 = 功能线数 = VOICE 键数）
 *  V2 public 原话必须能在 research/patient-voices.md 里逐字找到（防"改写后当引语"）
 *  V3 public 必须带出处；hypothesis 不得带出处（防止假设句挂假来源）
 *  V4 hypothesis 句在界面渲染为「假设句 · 未经访谈核实」（源码里必须有这一句）
 *  V5 本轮一手访谈 = 0：docs 与 research 里出现"访谈了/我们访谈"即失败
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const errors = []
const pages = JSON.parse(readFileSync(join(ROOT, 'src/pages.json'), 'utf8')).pages
const app = readFileSync(join(ROOT, 'prototypes/v0.2/app.js'), 'utf8')
const voices = readFileSync(join(ROOT, 'research/patient-voices.md'), 'utf8')
const featureLines = readFileSync(join(ROOT, 'docs/FEATURE-LINES.md'), 'utf8')

const norm = (t) => String(t).replace(/[「」『』""''’‘！？，。、；：…\s]/g, '')
const voicesNorm = norm(voices)

// 从 app.js 里抽 VOICE 对象条目
const block = app.slice(app.indexOf('const VOICE = {'), app.indexOf('const voiceBlock = (view) =>'))
const entries = [...block.matchAll(/^\s{2}(\w+): \{ status: '(\w+)', text: '([^']*)'(?:, src: '([^']*)')? \},?$/gm)]
  .map((m) => ({ view: m[1], status: m[2], text: m[3], src: m[4] }))

// V1
if (entries.length !== pages.length) errors.push(`V1 功能线 ${entries.length} ≠ 一级页 ${pages.length}`)
const missing = pages.filter((p) => !entries.find((e) => e.view === p.id))
if (missing.length) errors.push('V1 缺原话位的页：' + missing.map((p) => p.id).join(','))

// V2 / V3
for (const e of entries) {
  const plain = norm(e.text)
  if (e.status === 'public') {
    if (!e.src) errors.push(`V3 public 缺出处：${e.view}`)
    if (!plain || !voicesNorm.includes(plain)) errors.push(`V2 public 完整原话在 patient-voices.md 找不到：${e.view} → ${e.text}`)
  } else if (e.status === 'hypothesis') {
    if (e.src) errors.push(`V3 hypothesis 不应带出处：${e.view}`)
  } else {
    errors.push(`V3 未知证据状态：${e.view} = ${e.status}`)
  }
}

// V4
if (!app.includes('假设句 · 未经访谈核实')) errors.push('V4 界面缺少「假设句 · 未经访谈核实」文案')

// V5
// V5：只拦"肯定式"伪造；写在禁止句里的（不得/禁止/不要）不算
const banned = /我们访谈了|访谈了 ?\d+ ?位|interviewed \d+/
for (const [name, text] of [['docs/FEATURE-LINES.md', featureLines], ['research/patient-voices.md', voices]]) {
  for (const line of text.split('\n')) {
    if (!banned.test(line)) continue
    if (/不得|禁止|不许|不要|不可/.test(line)) continue
    errors.push(`V5 ${name} 出现伪造访谈表述：${line.trim().slice(0, 60)}`)
  }
}

// FEATURE-LINES 覆盖
const flRows = [...featureLines.matchAll(/^\| F\d{2} \| ([^|]+) \|/gm)].map((m) => m[1].trim())
if (flRows.length !== pages.length) errors.push(`FEATURE-LINES 行数 ${flRows.length} ≠ 一级页 ${pages.length}`)

const publicCount = entries.filter((e) => e.status === 'public').length
console.log(JSON.stringify({
  pages: pages.length,
  voices: entries.length,
  public: publicCount,
  hypothesis: entries.length - publicCount,
  interview: 0,
  errors,
}, null, 2))
process.exit(errors.length ? 1 : 0)
