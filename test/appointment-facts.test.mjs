import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { openDatabase, migrate, close } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { profileBundle } from '../dsh/readmodels.js'

// 语境：历史输血只能描述已经发生的事，不能冒充患者/医生登记的预约。
// 同时断言真实 SQLite 读模型及唯一演示源产物，防止只修其中一个出口。
test('无预约事实时，两个档案的读模型和演示产物都不推算下次预约', async () => {
  const db = await openDatabase(':memory:')
  try {
    migrate(db); seedDemo(db)
    const ctx = { window: {} }
    runInNewContext(readFileSync(new URL('../prototypes/v0.2/demo-data.js', import.meta.url), 'utf8'), ctx)
    for (const id of ['A', 'B']) {
      const bundle = profileBundle(db, id, { dataEnd: '2026-10-25' })
      assert.ok(bundle.transfusion.summary.count > 0)
      assert.equal(bundle.transfusion.summary.next_due, null)
      assert.equal(ctx.window.DEMO_DATA.profiles[id].transfusion.summary.next_due, null)
    }
  } finally { close(db) }
})
