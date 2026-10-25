/* 装机链路回归：宿主加载 dsh/index.js 时不能因为数据目录没建好而整体退出。
 *
 * 事故现场（Desktop 0.2.1-rc.3 / Node 24）：
 *   dsh: fatal load failure: Error: unable to open database file
 *       at openDatabase (.../dsh/store.js:23)
 * 两个原因叠在一起：
 *   1. dshHomePath('ferropal-workbench') 只拼路径，不创建目录；SQLite 也不建父目录；
 *   2. openDatabase() 是 async，openDataSource() 没 await，失败变成 unhandled rejection，
 *      宿主直接 exit 1（连 503 都来不及返回）。
 * 这里分别锁住：目录自动创建、apply 可等待、失败时降级为 503。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, migrate, close, DB_FILE } from '../dsh/store.js'
import { apply } from '../dsh/index.js'

function fakeRes() {
  return {
    status: 0,
    body: '',
    writeHead(status) { this.status = status },
    end(chunk) { if (chunk) this.body += chunk.toString('utf8') },
  }
}

function fakeContext() {
  const state = { registered: null, disposed: null }
  const ctx = {
    logger: { warn() {}, info() {} },
    connection: { requestRejection: () => undefined },
    webServer: { register: (options) => { state.registered = options; return () => {} } },
    effect: (run) => { state.disposed = run(); return () => {} },
  }
  return { ctx, state }
}

async function withTempDir(run) {
  const base = await mkdtemp(join(tmpdir(), 'ferropal-plugin-'))
  try { return await run(base) } finally { await rm(base, { recursive: true, force: true }) }
}

test('openDatabase：父目录不存在时自动创建（dshHomePath 不会创建）', async () => {
  await withTempDir(async (base) => {
    const root = join(base, 'not', 'created', 'yet')
    const db = await openDatabase(join(root, DB_FILE))
    try {
      assert.ok((await stat(join(root, DB_FILE))).isFile(), '库文件应落在自动创建的目录里')
      assert.ok(migrate(db).length >= 2, '建库后应能跑完迁移')
    } finally {
      close(db)
    }
  })
})

test('apply：root 目录尚不存在时正常加载并注册 API', async () => {
  await withTempDir(async (base) => {
    const root = join(base, 'ferropal-workbench')
    const { ctx, state } = fakeContext()

    await apply(ctx, { root })

    assert.ok(state.registered, 'webServer.register 必须被调用')
    assert.equal(state.registered.path, '/api/ferropal-workbench')

    const res = fakeRes()
    await state.registered.handler({ method: 'GET', url: '/api/ferropal-workbench/api/bootstrap' }, res)
    assert.equal(res.status, 200)
    const body = JSON.parse(res.body)
    assert.ok(body.profiles?.A, '演示档案 A 应可读')
    assert.ok(body.profiles?.B, '演示档案 B 应可读')

    state.disposed?.()
  })
})

test('apply：数据目录不可用时降级为 503，而不是让宿主 fatal', async () => {
  await withTempDir(async (base) => {
    const blocker = join(base, 'blocked')
    await writeFile(blocker, '') // 用普通文件占位，让 root 的父路径不可能是目录
    const { ctx, state } = fakeContext()

    await apply(ctx, { root: join(blocker, 'data') })

    assert.ok(state.registered, '打开失败也要注册路由，界面才能显示可读错误')
    const res = fakeRes()
    await state.registered.handler({ method: 'GET', url: '/api/ferropal-workbench/api/bootstrap' }, res)
    assert.equal(res.status, 503)
    assert.match(JSON.parse(res.body).detail, /blocked/, '错误详情应带上是哪个目录')

    state.disposed?.()
  })
})
