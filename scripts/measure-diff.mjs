#!/usr/bin/env node
/**
 * 重名率实测（防"换名复用"）。
 *
 * 为什么要有脚本：DIFF-MATRIX 里"一级重名率 ≤70%"是硬指标，手写数字没法复核。
 * 这里把三份页面树都当成数据读：
 *   - 本项目：src/pages.json（唯一源）
 *   - 样板基准：<repo>/prototypes/*\/app.js 里的 const PAGES / const SUBPAGES
 *   - 成熟基准：同上
 * 口径（写清楚才叫实测）：
 *   一级重名 = 页面 id 或中文 label 与对照仓完全一致；label 去掉"与/和/·"后一致也算同构。
 *   重名率 = 命中数 / 本项目一级页数。
 *   二级同口径，分母为本项目二级页数。
 *
 * 用法：node scripts/measure-diff.mjs [--json]
 *       SAMPLE_REPO=... BENCH_REPO=... 可覆盖默认路径
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HOME = process.env.HOME
const SAMPLE = process.env.SAMPLE_REPO || join(HOME, 'Downloads/xyb-work/cervical-workbench')
const BENCH = process.env.BENCH_REPO || join(HOME, 'Downloads/xyb-work/breast-cancer-workbench')
const SELF = resolve(import.meta.dirname, '..')

const norm = (s) => String(s).replace(/[\s·、/（）()]/g, '').replace(/与|和/g, '')

function readFamilyTree(repo) {
  const proto = join(repo, 'prototypes')
  if (!existsSync(proto)) return null
  // 取版本号最大的原型目录（v0.3 > v0.2）
  const dirs = readdirSync(proto).filter((d) => /^v\d/.test(d)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  for (const d of dirs) {
    const app = join(proto, d, 'app.js')
    if (!existsSync(app)) continue
    const src = readFileSync(app, 'utf8')
    const pagesMatch = src.match(/const PAGES = \[([\s\S]*?)\n\];/)
    if (!pagesMatch) continue
    const pages = [...pagesMatch[1].matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }))
    const subsMatch = src.match(/const SUBPAGES = \{([\s\S]*?)\n\};/)
    const subs = []
    if (subsMatch) {
      for (const m of subsMatch[1].matchAll(/(\w+): \[([\s\S]*?)\]/g)) {
        for (const s of m[2].matchAll(/'([^']+)'/g)) subs.push({ parent: m[1], label: s[1] })
      }
    }
    return { repo, prototype: d, pages, subs }
  }
  return null
}

const self = JSON.parse(readFileSync(join(SELF, 'src/pages.json'), 'utf8'))
const mine = {
  pages: self.pages.map((p) => ({ id: p.id, label: p.label })),
  subs: self.pages.flatMap((p) => p.subs.map((label) => ({ parent: p.id, label }))),
}

function overlap(a, b, { byLabelOnly = false } = {}) {
  const bIds = new Set(byLabelOnly ? [] : b.map((x) => x.id).filter(Boolean))
  const bLabels = new Set(b.map((x) => norm(x.label)))
  const hit = a.filter((x) => (!byLabelOnly && x.id && bIds.has(x.id)) || bLabels.has(norm(x.label)))
  return { hit, rate: a.length ? hit.length / a.length : 0 }
}

const sample = readFamilyTree(SAMPLE)
const bench = readFamilyTree(BENCH)
if (!sample || !bench) {
  console.error('找不到对照仓原型（需要 prototypes/vX/app.js 里有 const PAGES）')
  process.exit(2)
}

const rows = []
for (const [name, ref] of [['cervical（样板基准）', sample], ['breast（成熟基准 26 号）', bench]]) {
  const l1 = overlap(mine.pages, ref.pages)
  const l2 = overlap(mine.subs, ref.subs, { byLabelOnly: true })
  rows.push({
    against: name,
    refPrototype: ref.prototype,
    refPages: ref.pages.length,
    refSubs: ref.subs.length,
    minePages: mine.pages.length,
    mineSubs: mine.subs.length,
    dupPages: l1.hit.map((x) => x.label),
    dupPageRate: +(l1.rate * 100).toFixed(1),
    dupSubs: l2.hit.map((x) => x.label),
    dupSubRate: +(l2.rate * 100).toFixed(1),
  })
}

const pass = rows.every((r) => r.dupPageRate <= 70)
const out = { generatedAt: new Date().toISOString(), threshold: '一级重名率 ≤70%', pass, rows }

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2))
} else {
  for (const r of rows) {
    console.log(`\n对照 ${r.against}（${r.refPrototype}：${r.refPages} 一级 / ${r.refSubs} 二级）`)
    console.log(`  一级：${r.minePages} 页，重名 ${r.dupPages.length} → ${r.dupPageRate}%  ${r.dupPages.length ? '[' + r.dupPages.join('、') + ']' : ''}`)
    console.log(`  二级：${r.mineSubs} 页，重名 ${r.dupSubs.length} → ${r.dupSubRate}%  ${r.dupSubs.length ? '[' + r.dupSubs.join('、') + ']' : ''}`)
  }
  console.log(`\n判定：${pass ? 'PASS' : 'FAIL'}（阈值 ${out.threshold}）`)
}
process.exit(pass ? 0 : 1)
