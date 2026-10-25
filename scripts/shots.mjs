#!/usr/bin/env node
/**
 * scripts/shots.mjs —— README 实渲截图（33 号：≥4 张，含折叠卡收/展态）
 *
 * 为什么用脚本而不是手动截图：33 号要求截图可复现、与 git HEAD 对应。
 * 每张截图固定 viewport + view/sub + 交互前置，重跑字节级接近（时间戳除外）。
 *
 *   node scripts/shots.mjs
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const URL = 'file://' + join(ROOT, 'prototypes/v0.2/index.html')
const OUT = join(ROOT, 'docs/screenshots')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('.nav-btn').length > 0)

const go = async (view, sub = 0) => {
  await page.evaluate((v, s) => {
    location.hash = v
    document.querySelector(`.nav-btn[data-view="${v}"]`).click()
    const tab = document.querySelector(`[data-act="sub"][data-view="${v}"][data-sub="${s}"]`)
    if (tab) tab.click()
  }, view, sub)
  await new Promise((r) => setTimeout(r, 120))
}
const shot = async (name) => {
  await page.screenshot({ path: join(OUT, name + '.png') })
  console.log('shot', name)
}

// 1 看板（含入口区与三张翻转卡）
await go('dashboard')
await shot('readme-dashboard-0.4.0')

// 2 输血本 · 周期与间隔（间隔折线 + 带宽说明）
await go('transfusion', 1)
await shot('readme-transfusion-interval-0.4.0')

// 3 铁负荷与排铁 · 铁蛋白趋势（事件竖线，无阈值线）
await go('iron', 0)
await shot('readme-iron-trend-0.4.0')

// 4 生长发育（百分位 + 示例参考表声明）
await go('growth', 0)
await shot('readme-growth-0.4.0')

// 5 折叠卡：收起态
await go('dashboard')
await shot('readme-fold-closed-0.4.0')

// 6 折叠卡：展开态
await page.click('.fold-head')
await new Promise((r) => setTimeout(r, 150))
await shot('readme-fold-open-0.4.0')

// 7 AI 面板打开（35%）+ 候选块
await page.click('[data-act="agent"]')
await page.waitForFunction(() => !document.querySelector('#agent-dock').hidden)
await page.type('#agent-input', '铁蛋白这次 3820')
await page.click('[data-act="agent-send"]')
await page.waitForSelector('.cand')
await shot('readme-agent-candidate-0.4.0')

// 8 窄宽 760（顶栏换行、导航保留文字、无横向溢出）
await page.setViewport({ width: 760, height: 900, deviceScaleFactor: 1 })
await go('screening', 2)
await shot('readme-narrow-760-0.4.0')

// 9 病情一图秀（多指标 + 事件竖线）
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await go('timeline', 0)
await shot('readme-timeline-0.4.0')

// 10 就诊准备（问题清单，带来源页）
await go('review', 1)
await shot('readme-review-questions-0.4.0')

await browser.close()
console.log('done →', OUT)
