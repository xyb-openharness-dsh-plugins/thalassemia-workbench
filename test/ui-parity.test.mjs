/* 原型 ↔ 开发版 parity：逐字符（源码）+ 逐字（渲染）。
 * 约定（写进断言，别口头说）：
 *  - public/app.js、public/style.css 与 prototypes/v0.2/ 下同名文件**字节一致**；
 *  - public/index.html 只允许在允许清单内的行不同（title/noindex/数据源提示条/脚本引用）；
 *  - 58 个 (view,sub) 的正文逐字一致（空白归一后）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { openDatabase, migrate } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { bootstrap } from '../dsh/readmodels.js'
import { createApiHandler } from '../dsh/server.js'

const ROOT = join(import.meta.dirname, '..')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

test('源码字节一致：app.js / style.css', () => {
  for (const f of ['app.js', 'style.css']) {
    const a = readFileSync(join(ROOT, 'prototypes/v0.2', f), 'utf8')
    const b = readFileSync(join(ROOT, 'public', f), 'utf8')
    assert.equal(a, b, `${f} 与原型不一致（public 是原型的复制，只允许 index.html 不同）`)
  }
})

test('index.html 的差异只在允许清单内', () => {
  const proto = readFileSync(join(ROOT, 'prototypes/v0.2/index.html'), 'utf8').split('\n')
  const pub = readFileSync(join(ROOT, 'public/index.html'), 'utf8').split('\n')
  // 允许清单：数据源提示条 / 标题 / noindex / 脚本引用。两边都剥掉这些行后再逐行比对。
  const allowed = /proto-bar|data-source|<title>|noindex|bootstrap\.js|demo-data\.js|app\.js/
  const strip = (lines) => lines.filter((l) => !allowed.test(l))
  const a = strip(proto)
  const b = strip(pub)
  assert.equal(a.length, b.length, `剥掉允许行后行数不同：原型 ${a.length} / 开发版 ${b.length}`)
  const bad = []
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) bad.push({ line: i + 1, proto: a[i], pub: b[i] })
  assert.equal(bad.length, 0, '允许清单外出现差异：' + JSON.stringify(bad.slice(0, 3)))
})

test('渲染逐字一致：58 个 (view,sub)', async () => {
  const db = await openDatabase(':memory:')
  migrate(db); seedDemo(db)
  const api = createApiHandler({
    source: { bootstrap: () => bootstrap(db, { version: 'parity' }), cadence: () => ({ checks: [] }),
      addTransfusion: () => { throw new Error('readonly') }, addFerritin: () => { throw new Error('readonly') }, addQuestion: () => { throw new Error('readonly') } },
    version: 'parity', prefix: '/api/ferropal-workbench',
  })
  const server = createServer((req, res) => api(req, res))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
  const pages = JSON.parse(readFileSync(join(ROOT, 'src/pages.json'), 'utf8')).pages
  const combos = pages.flatMap((p) => [{ v: p.id, s: 0, hasSub: p.subs.length > 0 }, ...p.subs.map((_, i) => ({ v: p.id, s: i, hasSub: true }))])
  const readAll = async (url) => {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelectorAll('.nav-btn').length > 0, { timeout: 15000 })
    const out = []
    for (const c of combos) {
      await page.evaluate((c) => {
        location.hash = c.v
        document.querySelector(`.nav-btn[data-view="${c.v}"]`).click()
        const tab = document.querySelector(`[data-act="sub"][data-view="${c.v}"][data-sub="${c.s}"]`)
        if (tab) tab.click()
      }, c)
      const text = await page.evaluate(() => document.querySelector('#main').innerText.replace(/\s+/g, ' ').trim())
      out.push({ ...c, text })
    }
    await page.close()
    return out
  }
  const proto = await readAll('file://' + join(ROOT, 'prototypes/v0.2/index.html'))
  const pub = await readAll(`http://127.0.0.1:${port}/api/ferropal-workbench/ui/`)
  await browser.close(); server.close(); db.close()

  const mismatches = []
  for (let i = 0; i < combos.length; i++) {
    if (proto[i].text !== pub[i].text) {
      mismatches.push({ view: combos[i].v, sub: combos[i].s, proto: proto[i].text.slice(0, 80), pub: pub[i].text.slice(0, 80) })
    }
  }
  assert.equal(mismatches.length, 0, '渲染不一致：' + JSON.stringify(mismatches.slice(0, 4), null, 2))
  assert.equal(pub.length, 58)
})
