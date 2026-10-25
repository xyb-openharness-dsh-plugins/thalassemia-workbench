/* 节奏层 G2：纯函数，不碰磁盘、不发提醒、不判分期。
 *
 * 三条边界（写在文件头，改代码前先读）：
 * 1. 只算"参考节点"与"距上次记录 N 天"，**不排计划、不发通知、不弹提醒**；
 * 2. 节点 = 起点（确诊日/首次输血日/生日）+ k×间隔，**不是**"上次复查 + 间隔"（一次没记也要能算出节点）；
 * 3. 不做分期判断；两套口径（中国指南每月 vs TIF 至少每 3 月）**并列返回，不取严**。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const CADENCE = JSON.parse(readFileSync(fileURLToPath(new URL('../assets/reference/guideline/cadence.json', import.meta.url)), 'utf8'))
export const BAND_DAYS = 30

/** 月末夹取：1/31 + 1 月 = 2 月末（不滑到 3/3）。 */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

export function addDays(iso, days) {
  const dt = new Date(iso + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function checkByCode(code) {
  return CADENCE.checks.find((c) => c.code === code) || null
}

/**
 * 参考节点：从起点按 k×间隔推，返回 {code,label,dates[],ref,band,alternates}。
 * dates 只含 ≤ until 的节点；band 是**显示带宽**（±30 天），不是指南内容。
 */
export function checkpoints(code, startIso, { until, count = 4, extraMonths } = {}) {
  const chk = checkByCode(code)
  if (!chk) return null
  const months = extraMonths ?? chk.interval_months
  if (!months || !startIso) return { code, label: chk.label, dates: [], ref: chk.ref, band: BAND_DAYS, note: '该检查项无固定间隔（未取得指南数字）' }
  const dates = []
  for (let k = 1; k <= count; k++) {
    const d = addMonths(startIso, months * k)
    if (until && d > until) break
    dates.push(d)
  }
  return { code, label: chk.label, dates, ref: chk.ref, band: BAND_DAYS, interval_months: months, alternates: chk.alternates || [] }
}

/** 距上次记录多少天；没记过返回 null（不返回 0——0 会被误读成"今天记过"）。 */
export function daysSinceLast(lastIso, today) {
  if (!lastIso) return null
  const ms = new Date(today + 'T00:00:00Z') - new Date(lastIso + 'T00:00:00Z')
  return Math.round(ms / 86400000)
}

/**
 * 随访计划（只读视图）：每项返回 {code,label,last,due,status,ref,alternates}。
 * status 三态：`recorded`（有记录且未过参考节点）/ `not_recorded`（从没记过）/ `past_due_reference`（过了参考节点）。
 * **注意**：`past_due_reference` 的语义是"超过参考节点"，不是"你该查了"；界面文案必须写成后者以外的话。
 */
export function buildFollowupPlan({ today, startIso, records = {} }) {
  return CADENCE.checks.map((chk) => {
    const last = records[chk.code] || null
    if (!chk.interval_months) {
      return { code: chk.code, label: chk.label, last, due: null, status: last ? 'recorded' : 'not_recorded', ref: chk.ref, alternates: chk.alternates || [], note: chk.note || '无固定间隔' }
    }
    const base = last || startIso
    if (!base) return { code: chk.code, label: chk.label, last, due: null, status: 'not_recorded', ref: chk.ref, alternates: chk.alternates || [] }
    const due = addMonths(base, chk.interval_months)
    const status = !last ? 'not_recorded' : (due < today ? 'past_due_reference' : 'recorded')
    return { code: chk.code, label: chk.label, last, due, status, ref: chk.ref, band: BAND_DAYS, alternates: chk.alternates || [] }
  })
}

/** 两套口径并列展示用：返回 [{doc, months, ref, note}]，主档在前。 */
export function dualCadence(code) {
  const chk = checkByCode(code)
  if (!chk) return []
  const main = [{ doc: 'tif', months: chk.interval_months, ref: chk.ref, note: '主档' }]
  return main.concat((chk.alternates || []).map((a) => ({ doc: a.doc, months: a.interval_months, ref: a.ref, note: a.note })))
}
