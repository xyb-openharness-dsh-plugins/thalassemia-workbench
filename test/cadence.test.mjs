import test from 'node:test'
import assert from 'node:assert/strict'
import { addMonths, checkpoints, daysSinceLast, buildFollowupPlan, dualCadence, CADENCE, BAND_DAYS } from '../dsh/cadence.js'

test('addMonths 月末夹取：1/31 + 1 月 = 2 月末（不滑到 3/3）', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30')
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
})

test('节点 = 起点 + k×间隔，没记过也要能算出来', () => {
  const c = checkpoints('ferritin', '2026-01-05', { until: '2026-12-31', count: 6 })
  assert.deepEqual(c.dates.slice(0, 3), ['2026-04-05', '2026-07-05', '2026-10-05'])
  assert.equal(c.interval_months, 3)
  assert.equal(c.band, BAND_DAYS, '显示带宽必须显式给出')
})

test('无固定间隔的检查项返回空节点而不是猜一个数字', () => {
  const c = checkpoints('liver_iron', '2026-01-05', { until: '2026-12-31' })
  assert.deepEqual(c.dates, [])
  assert.match(c.note, /未取得/)
})

test('daysSinceLast：没记过返回 null（不返回 0）', () => {
  assert.equal(daysSinceLast(null, '2026-10-25'), null)
  assert.equal(daysSinceLast('2026-10-01', '2026-10-25'), 24)
})

test('随访计划三态可区分', () => {
  const plan = buildFollowupPlan({ today: '2026-10-25', startIso: '2021-06-12', records: { ferritin: '2026-10-13', thyroid: '2025-01-01' } })
  const ferritin = plan.find((p) => p.code === 'ferritin')
  const thyroid = plan.find((p) => p.code === 'thyroid')
  const ogtt = plan.find((p) => p.code === 'ogtt')
  assert.equal(ferritin.status, 'recorded')
  assert.equal(thyroid.status, 'past_due_reference')
  assert.equal(ogtt.status, 'not_recorded')
})

test('两套口径并列，不取严', () => {
  const dual = dualCadence('ferritin')
  assert.ok(dual.length >= 2, '应有 TIF 与中国指南两条')
  assert.equal(dual[0].months, 3)
  assert.equal(dual[1].months, 1)
  const growth = dualCadence('growth')
  assert.ok(growth.length >= 2)
})

test('cadence.json 每个检查项都标了置信度', () => {
  for (const c of CADENCE.checks) assert.ok(['guideline', 'partial', 'unverified'].includes(c.confidence), c.code)
})
