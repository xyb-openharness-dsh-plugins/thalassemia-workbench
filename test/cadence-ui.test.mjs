/* 节奏层（G2）界面回归：只在服务端/读模型里有数据不算"启用"，必须真的出现在页面上。
 * 判据：参考节点卡存在、band_note 原文可见、无固定间隔项写"未取得"、不出现"该查/逾期/建议"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = join(import.meta.dirname, '..')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

test('筛查日历渲染参考节点且不冒充提醒', async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto('file://' + join(ROOT, 'prototypes/v0.2/index.html'), { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelectorAll('.nav-btn').length > 0)
    await page.evaluate(() => {
      location.hash = 'screening'
      document.querySelector('.nav-btn[data-view="screening"]').click()
    })
    const view = await page.evaluate(() => {
      // 只查节奏卡本身：患者原话（role=note）与页面副标题里的「该查什么」是患者的问题，不是提醒文案。
      const cadCard = [...document.querySelectorAll('#main .card')].find((c) => c.innerText.includes('参考节点'))
      const text = cadCard ? cadCard.innerText : ''
      const table = cadCard ? cadCard.querySelector('table') : null
      return {
        text,
        rows: table ? table.querySelectorAll('tbody tr').length : 0,
        headers: table ? [...table.querySelectorAll('th')].map((th) => th.textContent.trim()) : [],
      }
    })
    assert.ok(view.rows >= 5, '参考节点表至少列出 5 个检查项，实际 ' + view.rows)
    assert.ok(view.text.length > 50, '没找到参考节点卡')
    assert.deepEqual(view.headers.slice(0, 4), ['检查项', '起点', '最近节点', '上次记录'])
    assert.match(view.text, /节点仅作参考/, '必须常驻"仅参考"声明')
    assert.match(view.text, /不是预约/, '必须说明不是预约')
    assert.match(view.text, /无固定间隔（未取得指南数字）/, '未取得间隔的检查项必须如实写，不许编数字')
    // 这些词在"不是…"的否定句里必须能出现（页面要自己声明不是提醒），所以先剥掉否定分句。
    const affirmative = view.text.split(/[。；\n]/).filter((seg) => !/不是|禁止|不许|别把|不代表/.test(seg)).join('')
    const banned = ['该查', '逾期', '建议复查', '该复查']
    const hit = banned.filter((w) => affirmative.includes(w))
    assert.equal(hit.length, 0, '出现提醒式措辞：' + hit.join('、'))
  } finally { await browser.close() }
})
