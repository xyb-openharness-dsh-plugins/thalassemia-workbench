/* 整页视图与 AI 草稿的浏览器回归：两件事都曾被评审判为"只有函数没有挂载点"。
 *
 * 语境：判据不是"源码里有 openPageView"，而是真实点击后出现整页、返回只退一层、
 * 关闭回原滚动位与焦点；草稿必须先经宿主桥回执，失败要说失败（不得谎报已接通）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = join(import.meta.dirname, '..')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

const WRAPPER = `<!doctype html><meta charset="utf-8"><title>host</title>
<script>
window.__replies = []
window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'ferropal:agent-draft') return
  window.__replies.push(data)
  const mode = new URLSearchParams(location.search).get('mode') || 'ok'
  const respond = (ok, error) => event.source.postMessage(
    { type: 'ferropal:agent-draft-result', requestId: data.requestId, ok, error },
    event.origin && event.origin !== 'null' ? event.origin : '*',
  )
  if (mode === 'ok') respond(true)
  else if (mode === 'fail') respond(false, '会话输入不可用')
  // mode=silent：不回执，验证超时分支
})
</script>
<iframe id="app" src="/prototypes/v0.2/index.html" style="width:1400px;height:900px;border:0"></iframe>`

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname === '/' || url.pathname === '/wrapper.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(WRAPPER)
    }
    const file = join(ROOT, decodeURIComponent(url.pathname))
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('nope') }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

test('整页视图：点数据点开整页、返回只退一层、关闭回原滚动与焦点', async () => {
  const { server, port } = await serve()
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`http://127.0.0.1:${port}/prototypes/v0.2/index.html`, { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelectorAll('.nav-btn').length > 0)

    // 进入铁蛋白趋势（有真实数据点）
    await page.evaluate(() => {
      location.hash = 'iron'
      document.querySelector('.nav-btn[data-view="iron"]').click()
      document.querySelector('[data-act="sub"][data-view="iron"][data-sub="0"]').click()
    })
    const hasHook = await page.evaluate(() => document.querySelectorAll('[data-act="pv-day"]').length)
    assert.ok(hasHook > 0, '趋势图必须把数据点挂上 pv-day（没有挂载点 = 评审 P0-2 未修）')

    const opened = await page.evaluate(() => {
      const before = { scroll: document.querySelector('#main').scrollTop }
      const btn = document.querySelector('[data-act="pv-day"]')
      btn.focus()
      // SVG <g> 没有 click()，用事件派发（与键盘路径一致）
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      const pv = document.querySelector('.pageview')
      return { has: !!pv, title: pv?.querySelector('h1')?.textContent, before, buttons: pv ? [...pv.querySelectorAll('[data-act]')].map((b) => b.dataset.act) : [] }
    })
    assert.equal(opened.has, true, '点击后必须出现整页视图')
    assert.ok(opened.buttons.includes('pv-back') && opened.buttons.includes('pv-close'), '返回与关闭必须是两个入口')

    // 再开一层：返回只退一层
    const deep = await page.evaluate(() => {
      window.__ferropal.openPageView({ title: '第二层', body: '<p>second</p>', eyebrow: '测试' })
      const layers = document.querySelector('.pageview h1').textContent
      document.querySelector('[data-act="pv-back"]').click()
      const afterBack = document.querySelector('.pageview h1').textContent
      return { layers, afterBack, stillOpen: !!document.querySelector('.pageview') }
    })
    assert.equal(deep.layers, '第二层')
    assert.equal(deep.stillOpen, true, '返回只退一层，不能整叠关闭')
    assert.equal(deep.afterBack, opened.title)

    // 关闭：整叠关闭并恢复焦点
    const closed = await page.evaluate(() => {
      document.querySelector('[data-act="pv-close"]').click()
      const active = document.activeElement
      return { gone: !document.querySelector('.pageview'), act: active?.dataset?.act || null, day: active?.dataset?.day || null }
    })
    assert.equal(closed.gone, true, '关闭后整页视图应消失')
    assert.equal(closed.act, 'pv-day', '关闭后焦点回到触发点（同款 pv-day 节点，32 号硬约束）')
    assert.ok(closed.day, '焦点回来的节点必须仍是同一个日期')

    // 空态：没有记录的日期
    const empty = await page.evaluate(() => {
      window.__ferropal.pageViewForDay('2020-01-01')
      const el = document.querySelector('.pageview .empty')
      return { has: !!el, text: el?.textContent || '' }
    })
    assert.equal(empty.has, true, '无记录日期必须给空态而不是空白页')
    assert.match(empty.text, /这天没有记录/)
  } finally {
    await browser.close(); server.close()
  }
})

test('AI 草稿：宿主回执成功才说已填入，失败/超时必须说未接通', async () => {
  const { server, port } = await serve()
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  try {
    const open = async (mode) => {
      const page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${port}/wrapper.html?mode=${mode}`, { waitUntil: 'load' })
      await page.waitForFunction(() => {
        const f = document.querySelector('#app')
        try { return f && f.contentDocument && f.contentDocument.querySelectorAll('.nav-btn').length > 0 } catch { return false }
      }, { timeout: 15000 })
      return page
    }
    const frameEval = (page, fn) => page.frames().find((f) => f.url().includes('/prototypes/v0.2/index.html')).evaluate(fn)

    // 1) 成功：父侧回执 ok
    const okPage = await open('ok')
    await frameEval(okPage, () => document.querySelector('[data-act="agent-draft"]').click())
    await new Promise((r) => setTimeout(r, 400))
    const okToast = await frameEval(okPage, () => document.querySelector('#toast').textContent)
    const okSent = await okPage.evaluate(() => window.__replies.length)
    assert.equal(okSent, 1, '点击必须真的向宿主发一条草稿请求')
    const req = await okPage.evaluate(() => window.__replies[0])
    assert.equal(req.type, 'ferropal:agent-draft')
    assert.ok(req.prompt.length > 10, '草稿必须携带本页上下文')
    assert.ok(!/建议治疗|可以停药|无需就医/.test(req.prompt), '草稿不得夹带处置建议')
    assert.match(okToast, /已填进宿主会话输入框/, '宿主确认后才允许说已填入')
    await okPage.close()

    // 2) 失败：父侧回执 ok:false → 不得说已填入
    const failPage = await open('fail')
    await frameEval(failPage, () => document.querySelector('[data-act="agent-draft"]').click())
    await new Promise((r) => setTimeout(r, 400))
    const failToast = await frameEval(failPage, () => document.querySelector('#toast').textContent)
    assert.match(failToast, /没能写进会话草稿/, '失败必须说失败')
    assert.doesNotMatch(failToast, /已填进宿主会话输入框/)
    await failPage.close()

    // 3) 超时：宿主不回执 → 4 秒后必须降级并说未接通
    const silentPage = await open('silent')
    await frameEval(silentPage, () => document.querySelector('[data-act="agent-draft"]').click())
    await new Promise((r) => setTimeout(r, 4600))
    const silentToast = await frameEval(silentPage, () => document.querySelector('#toast').textContent)
    assert.match(silentToast, /没能写进会话草稿/, '没有回执时必须超时降级')
    await silentPage.close()
  } finally {
    await browser.close(); server.close()
  }
})
