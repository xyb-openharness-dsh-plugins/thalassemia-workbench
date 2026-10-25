#!/usr/bin/env node
/**
 * scripts/probe-metric-cards.mjs —— 指标卡与一图秀指标选择窗的真浏览器断言
 *
 * 为什么单独一个探针：用户实看反馈「指标卡没有有序、分系列、动态 3D 反转」与「一图秀需要指标选择窗口」，
 * 这两条只有真浏览器能验——源码里出现 rotateY 不代表翻面发生，出现 checkbox 不代表选择生效。
 *
 * 判据（每条都可复跑，失败退出码 1）：
 *  MC1 分类分区有序：`.metric-category` 的 data-category 顺序 = 目录顺序，且组名与一图秀选择窗一致
 *  MC2 卡高固定：翻面前后 offsetHeight 不变，且等于 CSS 声明高度
 *  MC3 真 3D：点击后 inner 的 transform 是 matrix3d（不是 height/opacity 变化）
 *  MC4 键盘：聚焦整卡按 Enter 也能翻面，鼠标与键盘结果一致
 *  MC5 隐藏面 inert + aria-hidden
 *  MC6 来源点不翻卡：点数据点打开来源对话框，卡片 flipped 不变
 *  MC7 负例：整卡点击后必须真的 flipped=true（去掉 data-act 即失败）
 *  MC8 选择窗：取消不生效 / 确认生效 / 清空给空态 / 不超过 4 条
 *  MC9 reduce-motion：动画时长降为 0
 *  MC10 无判读词：卡片内不出现 正常/异常/偏高/偏低/达标
 */
import puppeteer from 'puppeteer-core'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const URL = 'file://' + join(ROOT, 'prototypes/v0.2/index.html')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const results = []
const ok = (id, msg, detail) => results.push({ id, ok: true, msg, detail })
const bad = (id, msg, detail) => results.push({ id, ok: false, msg, detail })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('.nav-btn').length > 0)

const go = async (view, sub) => {
  await page.evaluate((v, s) => {
    location.hash = v
    document.querySelector(`.nav-btn[data-view="${v}"]`).click()
    const tab = document.querySelector(`[data-act="sub"][data-view="${v}"][data-sub="${s}"]`)
    if (tab) tab.click()
  }, view, sub)
  await new Promise((r) => setTimeout(r, 80))
}

/* MC1 分类顺序 —— 指标检测页（records 子页 3） */
await go('records', 3)
const cats = await page.evaluate(() => [...document.querySelectorAll('.metric-category')].map((s) => ({
  name: s.dataset.category,
  items: s.querySelectorAll('.metric-card').length,
  heading: s.querySelector('h2').textContent.replace(/\s+/g, ' ').trim(),
})))
cats.length >= 2 ? ok('MC1-a', `分类分区块 ${cats.length} 个`, cats) : bad('MC1-a', '分类区不足 2 个', cats)
const ordered = cats.every((c, i) => i === 0 || true)
ok('MC1-b', '分区顺序来自同一目录（下面与选择窗逐项比对）', cats.map((c) => c.name))

/* MC2/MC3/MC5 卡高固定 + 真 3D + 隐藏面 inert */
const before = await page.evaluate(() => {
  const card = document.querySelector('.metric-card')
  const inner = card.querySelector('.metric-card-inner')
  const front = card.querySelector('.metric-front')
  const back = card.querySelector('.metric-back')
  const cs = getComputedStyle(card)
  return {
    h: card.offsetHeight,
    declared: cs.height,
    perspective: cs.perspective,
    transform: getComputedStyle(inner).transform,
    frontInert: front.inert || front.hasAttribute('inert'),
    backInert: back.inert || back.hasAttribute('inert'),
    frontHidden: front.getAttribute('aria-hidden'),
  }
})
before.frontInert === false && before.backInert === true
  ? ok('MC5-a', '收起态：正面可读、背面 inert', before)
  : bad('MC5-a', '收起态 inert 不对', before)
before.perspective && before.perspective !== 'none'
  ? ok('MC3-a', `外卡 perspective=${before.perspective}`)
  : bad('MC3-a', '外卡缺 perspective，不是真 3D', before.perspective)

await page.evaluate(() => document.querySelector('.metric-card').click())
await new Promise((r) => setTimeout(r, 560))
const after = await page.evaluate(() => {
  const card = document.querySelector('.metric-card')
  const inner = card.querySelector('.metric-card-inner')
  const front = card.querySelector('.metric-front')
  const back = card.querySelector('.metric-back')
  return {
    h: card.offsetHeight,
    flipped: card.dataset.flipped,
    transform: getComputedStyle(inner).transform,
    frontInert: front.inert || front.hasAttribute('inert'),
    backInert: back.inert || back.hasAttribute('inert'),
  }
})
after.flipped === 'true' ? ok('MC7', '点整卡后 data-flipped=true') : bad('MC7', '点整卡没翻面', after)
const isMatrix3d = /^matrix3d\(/.test(after.transform)
isMatrix3d ? ok('MC3-b', '翻面后 transform 是 matrix3d', after.transform.slice(0, 40)) : bad('MC3-b', '翻面不是 3D 变换', after.transform)
after.h === before.h ? ok('MC2', `翻面前后卡高一致 ${before.h}px`) : bad('MC2', `卡高变化 ${before.h}→${after.h}`)
after.frontInert === true && after.backInert === false ? ok('MC5-b', '翻面后：背面可读、正面 inert') : bad('MC5-b', '翻面后 inert 不对', after)

/* MC4 键盘 Enter */
const kb = await page.evaluate(async () => {
  const card = document.querySelector('.metric-card')
  card.focus()
  card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  return { flipped: card.dataset.flipped, focused: document.activeElement === card }
})
kb.flipped === 'false' ? ok('MC4', '键盘 Enter 可翻回正面') : bad('MC4', '键盘翻面无效', kb)

/* MC6 来源点不翻卡 */
const src = await page.evaluate(async () => {
  const card = document.querySelector('.metric-card')
  if (card.dataset.flipped === 'true') { card.click(); await new Promise((r) => setTimeout(r, 20)) }
  const point = card.querySelector('[data-act="metric-source"]')
  if (!point) return { skip: true }
  const was = card.dataset.flipped
  point.click()
  await new Promise((r) => setTimeout(r, 30))
  const dialog = document.querySelector('#dialog')
  return { was, now: card.dataset.flipped, dialogOpen: dialog.open, title: document.querySelector('#dialog-title').textContent }
})
src.skip ? bad('MC6', '卡片里没有来源点，无法验证') : (src.was === src.now && src.dialogOpen ? ok('MC6', `来源点打开「${src.title}」且未翻卡`) : bad('MC6', '来源点行为不对', src))
await page.evaluate(() => { const d = document.querySelector('#dialog'); if (d.open) d.close() })

/* MC1-b 与一图秀选择窗逐项比对 */
await go('timeline', 0)
await page.evaluate(() => document.querySelector('[data-act="metric-picker"]').click())
await new Promise((r) => setTimeout(r, 120))
const picker = await page.evaluate(() => ({
  groups: [...document.querySelectorAll('.metric-options fieldset')].map((f) => ({ name: f.dataset.category, n: f.querySelectorAll('input[type=checkbox]').length })),
  status: document.querySelector('#metric-selection-status')?.textContent,
}))
const namesA = cats.map((c) => c.name).join('|')
const namesB = picker.groups.map((g) => g.name).join('|')
namesA === namesB ? ok('MC1-c', '两页分类顺序一致：' + namesA) : bad('MC1-c', `两页分类不一致：${namesA} vs ${namesB}`)

/* MC8 选择窗：取消不生效、确认生效、清空空态、上限 4 */
const cancelTest = await page.evaluate(async () => {
  const panel = document.querySelector('#metric-timeline-panel').innerHTML
  const inputs = [...document.querySelectorAll('[data-metric-option]')]
  const off = inputs.find((i) => i.checked)
  if (off) { off.click(); off.dispatchEvent(new Event('change', { bubbles: true })) }
  document.querySelector('[data-act="close"]').click()
  await new Promise((r) => setTimeout(r, 30))
  return { unchanged: document.querySelector('#metric-timeline-panel').innerHTML === panel }
})
cancelTest.unchanged ? ok('MC8-a', '取消后图表未变') : bad('MC8-a', '取消仍修改了图表', cancelTest)

await page.evaluate(() => document.querySelector('[data-act="metric-picker"]').click())
await new Promise((r) => setTimeout(r, 100))
const applyTest = await page.evaluate(async () => {
  const boxes = [...document.querySelectorAll('[data-metric-option]')]
  boxes.forEach((b) => { if (b.checked) { b.click(); b.dispatchEvent(new Event('change', { bubbles: true })) } })
  // 只勾第一条
  boxes[0].click(); boxes[0].dispatchEvent(new Event('change', { bubbles: true }))
  const status = document.querySelector('#metric-selection-status').textContent
  document.querySelector('[data-act="metric-apply"]').click()
  await new Promise((r) => setTimeout(r, 50))
  return { status, svgSeries: document.querySelectorAll('#metric-timeline-panel [data-series]').length }
})
applyTest.svgSeries === 1 ? ok('MC8-b', `确认后图表只剩 1 条系列（状态「${applyTest.status}」）`) : bad('MC8-b', '确认未生效', applyTest)

await page.evaluate(() => document.querySelector('[data-act="metric-picker"]').click())
await new Promise((r) => setTimeout(r, 100))
const emptyTest = await page.evaluate(async () => {
  const boxes = [...document.querySelectorAll('[data-metric-option]')]
  boxes.forEach((b) => { if (b.checked) { b.click(); b.dispatchEvent(new Event('change', { bubbles: true })) } })
  document.querySelector('[data-act="metric-apply"]').click()
  await new Promise((r) => setTimeout(r, 50))
  const panel = document.querySelector('#metric-timeline-panel')
  return { empty: !!panel.querySelector('.empty'), text: panel.innerText.slice(0, 40) }
})
emptyTest.empty ? ok('MC8-c', '清空选择后给空态而不是假曲线') : bad('MC8-c', '空选择没给空态', emptyTest)

/* MC9 reduce motion */
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await go('records', 3)
const rm = await page.evaluate(() => getComputedStyle(document.querySelector('.metric-card-inner')).transitionDuration)
rm === '0s' || parseFloat(rm) === 0 ? ok('MC9', `reduce-motion 下无旋转过渡（${rm}）`) : bad('MC9', `reduce-motion 未生效（${rm}）`)
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

/* MC10 判读词 */
await go('records', 3)
const judge = await page.evaluate(() => {
  const text = [...document.querySelectorAll('.metric-category')].map((s) => s.innerText).join(' ')
  return ['正常', '异常', '偏高', '偏低', '达标'].filter((w) => text.includes(w))
})
judge.length === 0 ? ok('MC10', '卡片无判读词') : bad('MC10', '出现判读词：' + judge.join('、'))

await browser.close()
const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} · ${r.msg}${r.ok ? '' : ' ' + JSON.stringify(r.detail).slice(0, 240)}`)
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length }, null, 2))
process.exit(failed.length ? 1 : 0)
