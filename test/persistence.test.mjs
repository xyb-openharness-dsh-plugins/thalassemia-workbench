import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { openDatabase, migrate, close } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { bootstrap } from '../dsh/readmodels.js'
import { createApiHandler } from '../dsh/server.js'
import { insertTransfusion, insertFerritin, insertQuestion, insertGrowth } from '../dsh/index.js'

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const counts = (db, id) => Object.fromEntries(['transfusion', 'iron_lab', 'growth_measure', 'question_item'].map((table) => [table, db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE profile_id = ?`).get(id).n]))

for (const prefix of ['', '/api/ferropal-workbench']) {
  test(`真实页面保存、重载、重开 SQLite；apiBase=${prefix || '(empty)'}`, { timeout: 90000 }, async () => {
    const root = mkdtempSync(join(tmpdir(), 'ferropal-persistence-'))
    const file = join(root, 'test.sqlite')
    let db, server, browser
    let reject = false, gate = null
    const posts = []
    try {
      db = await openDatabase(file)
      migrate(db); seedDemo(db)
      const beforeA = counts(db, 'A'), beforeB = counts(db, 'B')
      const source = {
        bootstrap: () => bootstrap(db),
        addTransfusion: (b) => insertTransfusion(db, b),
        addFerritin: (b) => insertFerritin(db, b),
        addGrowth: (b) => insertGrowth(db, b),
        addQuestion: (b) => insertQuestion(db, b),
      }
      const api = createApiHandler({ source, version: 'test', prefix })
      server = createServer(async (req, res) => {
        if (req.method === 'POST') {
          posts.push(req.url)
          if (gate) await gate
          if (reject) {
            res.writeHead(503, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: '测试服务不可用' })); return
          }
        }
        return api(req, res)
      })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] })
      const page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${server.address().port}${prefix}/ui/`)
      await page.waitForSelector('[data-act="add-transfusion"]')
      await page.click('#profile-btn'); await page.click('[data-act="switch-profile"]')
      async function fill(values) {
        for (const [id, value] of Object.entries(values)) {
          await page.$eval('#' + id, (el, v) => { el.value = v }, value)
        }
      }
      async function save(kind) {
        await page.click(`[data-act="save-${kind}"]`)
        await page.waitForFunction(() => !document.querySelector('#dialog').open)
      }
      await page.click('[data-act="add-transfusion"]')
      await fill({ 'f-date': '2026-10-25', 'f-hb': '83', 'f-units': '2', 'f-product': '持久化血制品', 'f-reaction': '无' })
      // POST 尚未完成时不能关闭表单、改读模型或显示成功。
      let release
      gate = new Promise((resolve) => { release = resolve })
      await page.click('[data-act="save-transfusion"]')
      await page.waitForFunction(() => document.querySelector('[data-act="save-transfusion"]').disabled)
      assert.deepEqual(counts(db, 'B'), beforeB)
      assert.equal(await page.$eval('#dialog', (d) => d.open), true)
      assert.doesNotMatch(await page.$eval('#toast', (el) => el.textContent), /已记上/)
      release(); gate = null
      await page.waitForFunction(() => !document.querySelector('#dialog').open)
      await page.click('[data-act="nav"][data-view="iron"]')
      await page.click('[data-act="more"][data-page="iron"]')
      await page.click('[data-act="add-ferritin"]')
      await fill({ 'f-date': '2026-10-25', 'f-ft': '4321', 'f-unit': 'ng/mL', 'f-ref': '15–500' })
      await save('ferritin')
      await page.click('[data-act="nav"][data-view="growth"]')
      await page.click('[data-act="more"][data-page="growth"]')
      await page.click('[data-act="add-growth"]')
      await fill({ 'f-date': '2026-10-25', 'f-h': '169.4', 'f-w': '58.2' })
      await save('growth')
      await page.click('[data-act="nav"][data-view="review"]')
      await page.click('[data-act="sub"][data-view="review"][data-sub="1"]')
      await page.click('[data-act="add-question"]')
      await fill({ 'f-q': '持久化闭环测试问题' })
      await save('question')
      const expectedB = Object.fromEntries(Object.entries(beforeB).map(([k, n]) => [k, n + 1]))
      assert.deepEqual(counts(db, 'A'), beforeA)
      assert.deepEqual(counts(db, 'B'), expectedB)
      assert.equal(posts.length, 4)
      assert.ok(posts.every((url) => url.startsWith(prefix + '/api/')))
      await page.reload()
      await page.waitForFunction(() => !!window.FERROPAL_PERSISTENCE && !!window.DEMO_DATA)
      const persisted = await page.evaluate(() => {
        const b = window.DEMO_DATA.profiles.B
        return [b.transfusion.rows.some((r) => r[3] === '持久化血制品'), b.iron.rows.some((r) => r[1] === '4321' && r[3].includes('15–500')), b.growth.rows.some((r) => r[1] === '169.4' && r[2] === '58.2'), b.questions.rows.some((r) => r[0] === '持久化闭环测试问题')]
      })
      assert.deepEqual(persisted, [true, true, true, true])
      // 服务失败：输入、对话框和内存均保留，不假成功。
      await page.waitForSelector('#profile-btn')
      await page.click('#profile-btn'); await page.click('[data-act="switch-profile"]')
      await page.click('[data-act="nav"][data-view="review"]')
      await page.click('[data-act="sub"][data-view="review"][data-sub="1"]')
      await page.click('[data-act="add-question"]')
      await fill({ 'f-q': '失败不能成为事实' })
      reject = true
      const toastBefore = await page.$eval('#toast', (el) => el.textContent)
      await page.click('[data-act="save-question"]')
      await page.waitForSelector('#save-error')
      assert.match(await page.$eval('#save-error', (el) => el.textContent), /测试服务不可用/)
      assert.equal(await page.$eval('#dialog', (d) => d.open), true)
      assert.equal(await page.$eval('#f-q', (el) => el.value), '失败不能成为事实')
      assert.equal(await page.$eval('#toast', (el) => el.textContent), toastBefore)
      assert.equal(await page.evaluate(() => window.DEMO_DATA.profiles.B.questions.rows.some((r) => r[0] === '失败不能成为事实')), false)
      assert.deepEqual(counts(db, 'B'), expectedB)
      close(db); db = null
      db = await openDatabase(file)
      assert.deepEqual(counts(db, 'A'), beforeA)
      assert.deepEqual(counts(db, 'B'), expectedB)
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
      console.log(JSON.stringify({ apiBase: prefix, posts: posts.length, saved: 4, reloadVerified: 4, reopenedVerified: 4, failedPosts: 1, profileAUnchanged: true }))
    } finally {
      if (browser) await browser.close()
      if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
      if (db) close(db)
      // root is the exact mkdtemp path created above, never a user data directory.
      assert.ok(root.startsWith(join(tmpdir(), 'ferropal-persistence-')))
      rmSync(root, { recursive: true, force: true })
    }
  })
}
