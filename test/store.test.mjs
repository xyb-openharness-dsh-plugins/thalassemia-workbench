import test from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, migrate, profileCount, close, DB_FILE } from '../dsh/store.js'
import { seedDemo, hasDemoData } from '../dsh/demo.js'

test('迁移幂等：同一份 SQL 跑两次不报错', async () => {
  const db = await openDatabase(':memory:')
  const first = migrate(db)
  const second = migrate(db)
  assert.ok(first.length >= 2, '至少 0001 + 0002 两份迁移')
  assert.deepEqual(second, [], '第二次不应再执行任何迁移（schema_migrations 记账）')
  close(db)
})

test('播种幂等：第二次不重复插入', async () => {
  const db = await openDatabase(':memory:')
  migrate(db)
  const a = seedDemo(db)
  const b = seedDemo(db)
  assert.equal(a.inserted, true)
  assert.equal(b.inserted, false)
  assert.equal(profileCount(db), 2)
  assert.equal(hasDemoData(db), true)
  close(db)
})

test('显式 null：没填的参考区间是 NULL，不是 0', async () => {
  const db = await openDatabase(':memory:')
  migrate(db); seedDemo(db)
  const rows = db.prepare('SELECT ref_low, ref_high FROM iron_lab').all()
  assert.ok(rows.length > 0)
  assert.ok(rows.every((r) => r.ref_low === null), '演示数据的 ref_low 应为 NULL')
  close(db)
})

test('排序：输血记录按日期升序，且 rowid 兜底稳定', async () => {
  const db = await openDatabase(':memory:')
  migrate(db); seedDemo(db)
  const rows = db.prepare('SELECT date FROM transfusion WHERE profile_id = ? ORDER BY date ASC, rowid ASC').all('A')
  const dates = rows.map((r) => r.date)
  assert.deepEqual(dates, [...dates].sort())
  close(db)
})

test('DB_FILE 与 identity 一致', () => {
  assert.equal(DB_FILE, 'xyb-ferropal.sqlite')
})
