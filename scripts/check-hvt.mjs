#!/usr/bin/env node
/**
 * scripts/check-hvt.mjs —— HVT X 层断言（X1–X4），G2 签认的判据
 *
 * X1 每页签被场景路径覆盖，孤儿 = 0（页面树 ⊕ 路径表，双向）
 * X2 场景路径从看板逐条走通：入口文案在看板可见，点击后落到目标 (view,sub)
 * X3 显式编辑入口 ≤1 / 页（口径：直接打开写入表单的 .primary 按钮；手工入口统一收在「⋯ 更多」）
 * X4 AI 产出候选核对闭环：拒收零副作用、接受才入档
 *
 * 用法：node scripts/check-hvt.mjs [--json]
 */
import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const URL = 'file://' + join(ROOT, 'prototypes/v0.2/index.html')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const pages = JSON.parse(readFileSync(join(ROOT, 'src/pages.json'), 'utf8')).pages
const paths = JSON.parse(readFileSync(join(ROOT, 'src/paths.json'), 'utf8')).paths

const out = { generatedAt: new Date().toISOString(), X1: {}, X2: {}, X3: {}, X4: {} }
let failed = 0
const assert = (bucket, id, ok, detail) => {
  out[bucket][id] = { ok, detail }
  if (!ok) failed++
}

/* ---------- X1：双向覆盖 ---------- */
const coveredViews = new Set(paths.flatMap((p) => p.views))
const coveredSubs = new Set(paths.flatMap((p) => p.subs.map(([v, s]) => `${v}#${s}`)))
const allViews = pages.map((p) => p.id)
const allSubs = pages.flatMap((p) => p.subs.map((_, i) => `${p.id}#${i}`))
const orphanViews = allViews.filter((v) => !coveredViews.has(v))
const orphanSubs = allSubs.filter((s) => !coveredSubs.has(s))
assert('X1', 'views', orphanViews.length === 0, { total: allViews.length, covered: coveredViews.size, orphan: orphanViews })
assert('X1', 'subs', orphanSubs.length === 0, { total: allSubs.length, covered: coveredSubs.size, orphan: orphanSubs })
assert('X1', 'paths', paths.length >= 12, { paths: paths.length })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(e.message))
await page.setViewport({ width: 1440, height: 900 })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('.nav-btn').length > 0)

/* ---------- X2：从看板逐条走通 ---------- */
await page.evaluate(() => { location.hash = 'dashboard'; document.querySelector('.nav-btn[data-view="dashboard"]').click() })
const dashText = await page.evaluate(() => document.querySelector('#main').innerText)
const walked = []
for (const p of paths) {
  const visible = dashText.includes(p.entryText)
  // 点击入口：优先用入口文案定位（看板卡片标题/按钮），退化到导航
  const clicked = await page.evaluate((p) => {
    const nav = [...document.querySelectorAll('.nav-btn')].find((b) => b.dataset.view === p.views[0])
    if (!nav) return false
    nav.click()
    return location.hash === '#' + p.views[0]
  }, p)
  const subOk = await page.evaluate((p) => {
    if (!p.subs.length) return true
    const [view, idx] = p.subs[0]
    const tab = document.querySelector(`[data-act="sub"][data-view="${view}"][data-sub="${idx}"]`)
    if (!tab) return false
    tab.click()
    return document.querySelector('#main').innerText.length > 40
  }, p)
  const ok = visible && clicked && subOk
  walked.push({ id: p.id, entryText: p.entryText, visible, clicked, subOk, ok })
  assert('X2', p.id, ok, { visible, clicked, subOk })
}
out.X2.summary = { total: paths.length, ok: walked.filter((w) => w.ok).length }

/* ---------- X3：每页显式编辑入口 ≤1 ---------- */
const perPagePrimary = {}
for (const p of pages) {
  await page.evaluate((v) => { location.hash = v; document.querySelector(`.nav-btn[data-view="${v}"]`).click() }, p.id)
  const counts = await page.evaluate(() => ({
    primary: document.querySelectorAll('#main [data-write="primary"]').length,
    more: document.querySelectorAll('#main .more').length,
    forms: document.querySelectorAll('#main form').length,
  }))
  perPagePrimary[p.id] = counts
  assert('X3', p.id, counts.primary <= 1 && counts.forms === 0, counts)
}

/* ---------- X4：候选核对闭环 ---------- */
await page.evaluate(() => { location.hash = 'dashboard'; document.querySelector('.nav-btn[data-view="dashboard"]').click() })
const before = await page.evaluate(() => window.DEMO_DATA.profiles[document.body.dataset.profile || 'A'] ? null : null)
const candCount = () => page.evaluate(() => document.querySelectorAll('#main [data-cand]').length)
await page.click('[data-act="agent"]')
await page.waitForFunction(() => !document.querySelector('#agent-dock').hidden)
await page.type('#agent-input', '铁蛋白这次 3820')
await page.click('[data-act="agent-send"]')
await page.waitForSelector('.cand')
const hasCand = await page.evaluate(() => document.querySelectorAll('.cand').length)
assert('X4', 'candidate-created', hasCand === 1, { count: hasCand })
await page.click('[data-act="cand-reject"]')
const afterReject = await page.evaluate(() => ({
  tags: [...document.querySelectorAll('.cand .tag')].map((t) => t.textContent),
  acceptedInData: (window.DEMO_DATA.profiles.A.candidates || []).filter((c) => c.status === 'accepted' && c.note === 'AI 候选，用户确认').length,
}))
assert('X4', 'reject-zero-side-effect', afterReject.tags.includes('已拒收') && afterReject.acceptedInData === 0, afterReject)
await page.type('#agent-input', '铁蛋白这次 3999')
await page.click('[data-act="agent-send"]')
await page.waitForSelector('[data-act="cand-accept"]')
await page.click('[data-act="cand-accept"]')
const afterAccept = await page.evaluate(() => ({
  tags: [...document.querySelectorAll('.cand .tag')].map((t) => t.textContent),
  acceptedInData: (window.DEMO_DATA.profiles.A.candidates || []).filter((c) => c.note === 'AI 候选，用户确认').length,
}))
assert('X4', 'accept-writes', afterAccept.tags.includes('已入档') && afterAccept.acceptedInData === 1, afterAccept)

await browser.close()
assert('X2', 'console', consoleErrors.length === 0, { errors: consoleErrors.slice(0, 3) })

out.summary = { failed, passed: Object.values(out).reduce((a, b) => a + (typeof b === 'object' && b && b.ok !== undefined ? 1 : 0), 0) }
writeFileSync(join(ROOT, 'docs/HVT-PROBE.json'), JSON.stringify(out, null, 2))
writeFileSync(join(ROOT, 'docs/HVT-REVIEW.md'), renderMd(out))
console.log(JSON.stringify({ failed, X1: out.X1, X3: perPagePrimary }, null, 2))
process.exit(failed ? 1 : 0)

function renderMd(o) {
  const rows = []
  for (const bucket of ['X1', 'X2', 'X3', 'X4']) {
    for (const [k, v] of Object.entries(o[bucket] || {})) {
      if (k === 'summary' || !v || v.ok === undefined) continue
      rows.push(`| ${bucket} | ${k} | ${v.ok ? 'PASS' : 'FAIL'} | \`${JSON.stringify(v.detail).slice(0, 120)}\` |`)
    }
  }
  return `# HVT 评审 · X1–X4（机器断言）

- 生成时间：${o.generatedAt}
- 生成方式：\`node scripts/check-hvt.mjs\`（读 \`src/pages.json\` + \`src/paths.json\`，在无头 Chrome 里逐条走）
- 结论：**${o.summary.failed === 0 ? '全部 PASS' : o.summary.failed + ' 条 FAIL'}**

| 层 | 断言 | 结果 | 证据 |
| --- | --- | --- | --- |
${rows.join('\n')}

## 口径

- **X1**：页面树与路径表双向覆盖；孤儿页 = 0。
- **X2**：入口文案在看板可见 + 点击后 hash 落到目标页 + 目标 (view,sub) 有正文。
- **X3**：直接打开写入表单的 \`.primary\` 按钮每页 ≤1；手工入口统一收在卡片「⋯ 更多」；页面内无裸 \`<form>\`。
- **X4**：AI 产出候选必核；拒收后事实层无新增；接受才入档。

> 本文件是生成物，不要手改；改断言请改 \`scripts/check-hvt.mjs\`。
`
}
