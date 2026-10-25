import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { openDatabase, migrate } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { bootstrap, getProfile } from '../dsh/readmodels.js'
import { createApiHandler } from '../dsh/server.js'
import { insertTransfusion, insertFerritin, insertQuestion } from '../dsh/index.js'

async function listen() {
  const db = await openDatabase(':memory:')
  migrate(db); seedDemo(db)
  const api = createApiHandler({
    source: {
      bootstrap: () => bootstrap(db, { version: 'test' }),
      cadence: () => ({ checks: [] }),
      addTransfusion: (b) => insertTransfusion(db, b),
      addFerritin: (b) => insertFerritin(db, b),
      addQuestion: (b) => insertQuestion(db, b),
    },
    version: 'test',
    prefix: '/api/ferropal-workbench',
  })
  const server = createServer((req, res) => api(req, res))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { server, db, port: server.address().port }
}

test('health 与 bootstrap', async () => {
  const { server, db, port } = await listen()
  const health = await fetch(`http://127.0.0.1:${port}/api/ferropal-workbench/api/health`).then((r) => r.json())
  assert.equal(health.ok, true)
  const boot = await fetch(`http://127.0.0.1:${port}/api/ferropal-workbench/api/bootstrap`).then((r) => r.json())
  assert.deepEqual(Object.keys(boot.profiles).sort(), ['A', 'B'])
  assert.equal(boot.profiles.A.transfusion.rows.length > 0, true)
  assert.equal(boot.pages.length, 13)
  server.close(); db.close()
})

test('写入：日期非法 → 400 且不落库', async () => {
  const { server, db, port } = await listen()
  const before = db.prepare('SELECT COUNT(*) AS n FROM transfusion').get().n
  const res = await fetch(`http://127.0.0.1:${port}/api/ferropal-workbench/api/transfusion`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date: '2026/10/25', hb_before: 78 }),
  })
  assert.equal(res.status, 400)
  const after = db.prepare('SELECT COUNT(*) AS n FROM transfusion').get().n
  assert.equal(after, before, '校验失败不得落库')
  server.close(); db.close()
})

test('写入：空 Hb 存 NULL 不存 0', async () => {
  const { server, db, port } = await listen()
  const res = await fetch(`http://127.0.0.1:${port}/api/ferropal-workbench/api/transfusion`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date: '2026-10-25', hb_before: '', units: '' }),
  })
  assert.equal(res.status, 201)
  const row = db.prepare("SELECT hb_before FROM transfusion WHERE date = '2026-10-25'").get()
  assert.equal(row.hb_before, null)
  server.close(); db.close()
})

test('未知 /api/* 返回 JSON 404（不是 HTML）', async () => {
  const { server, db, port } = await listen()
  const res = await fetch(`http://127.0.0.1:${port}/api/ferropal-workbench/api/nope`)
  assert.equal(res.status, 404)
  assert.match(res.headers.get('content-type'), /application\/json/)
  server.close(); db.close()
})

test('读模型：分类值不补 unit 键 / events 定长数组', async () => {
  const { server, db, port } = await listen()
  const boot = await fetch(`http://127.0.0.1:${port}/api/ferropal-workbench/api/bootstrap`).then((r) => r.json())
  assert.ok(Array.isArray(boot.profiles.A.events))
  assert.ok(Array.isArray(boot.profiles.A.series.hb))
  assert.ok(boot.profiles.A.docs.every((d) => !('unit' in d)))
  server.close(); db.close()
})
