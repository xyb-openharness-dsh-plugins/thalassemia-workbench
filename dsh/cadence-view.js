/* 节奏读视图：只返回可序列化的参考节点，不生成预约或医嘱。
 *
 * 两个入口共用同一份计算：
 *   - 服务端 cadenceSnapshot(db, profileId, asOf)  → /api/cadence
 *   - 演示源 demo/build-demo-data.mjs 直接调 cadenceSnapshotFromFacts(facts, asOf) → demo-data.js
 * 这样原型（file://）与开发版（HTTP）看到同一套字段，parity 才能逐字对齐。
 */
import { CADENCE, BAND_DAYS, addMonths, daysSinceLast } from './cadence.js'

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
}

const clean = (v) => (validDate(v) ? v : null)

/**
 * 纯函数：从"事实集合"算参考节点。
 * facts = { birth_date, dx_date, transfusion_start, records: { ferritin, growth, t2star_cardiac, thyroid, ogtt, cardiac_function, liver_iron } }
 */
export function cadenceSnapshotFromFacts(facts = {}, asOf = '2026-10-25', profileId = null) {
  if (!validDate(asOf)) throw Object.assign(new Error('as_of 必须是有效的 YYYY-MM-DD'), { status: 400 })
  const records = facts.records || {}
  const checks = CADENCE.checks.map((check) => {
    const rule = check.start || (check.start_age_years ? `age_${check.start_age_years}` : null)
    let start = null
    let startNote = null
    if (rule === 'transfusion_start') start = clean(facts.transfusion_start)
    else if (rule === 'birth') start = clean(facts.birth_date)
    else if (/^age_\d+$/.test(rule || '') && clean(facts.birth_date)) start = addMonths(facts.birth_date, Number(rule.slice(4)) * 12)
    else if (rule === 'age_9_or_transfusion_year_7') startNote = '复合起点规则尚未确认取值口径，不自动选择起点'
    if (!start && !startNote) startNote = '起点事实未记录或无有效日期'

    const interval = check.interval_months
    const dates = []
    if (start && Number.isFinite(interval) && interval > 0 && start <= asOf) {
      // 从规则起点推导，不以最近一次记录重置节奏；只给最近四个已到节点。
      const elapsed = (Number(asOf.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(asOf.slice(5, 7)) - Number(start.slice(5, 7))
      const end = Math.floor(elapsed / interval)
      for (let k = Math.max(1, end - 4); k <= end; k++) {
        const date = addMonths(start, k * interval)
        if (date <= asOf) dates.push(date)
      }
    }
    const last = clean(records[check.code])
    return {
      code: check.code, label: check.label, interval_months: Number.isFinite(interval) ? interval : null,
      ref: check.ref || null, confidence: check.confidence, alternates: check.alternates || [],
      start_rule: rule, start_date: start, start_note: startNote,
      dates, last_date: last, days_since: daysSinceLast(last, asOf),
      band_days: BAND_DAYS, reference_only: true,
      note: check.note || null,
    }
  })
  return {
    profile_id: profileId, as_of: asOf, checks,
    band_note: CADENCE.band_note, documents: CADENCE.documents,
    reference_note: '节点仅作参考，不是预约、医嘱或该检查的提醒；没有记录不代表没有做。',
  }
}

/** 服务端入口：先从库里取"事实起点 + 各项最近一次记录"，再走同一个纯函数。 */
export function cadenceSnapshot(db, profileId, asOf = '2026-10-25') {
  if (!validDate(asOf)) throw Object.assign(new Error('as_of 必须是有效的 YYYY-MM-DD'), { status: 400 })
  const profile = db.prepare('SELECT * FROM profile WHERE id = ?').get(profileId)
  if (!profile) throw Object.assign(new Error('档案不存在：' + profileId), { status: 404 })
  const latest = (table, column = 'date', condition = '', args = []) => {
    try {
      const row = db.prepare(`SELECT MAX(${column}) AS date FROM ${table} WHERE profile_id = ? ${condition} AND ${column} <= ?`).get(profileId, ...args, asOf)
      return clean(row?.date)
    } catch { return null }
  }
  const records = {
    ferritin: latest('iron_lab'),
    growth: latest('growth_measure'),
    t2star_cardiac: latest('t2star_report', 'date', 'AND organ = ?', ['heart']),
    // 肝铁 LIC 与肝 T2* 不是同一指标；没有独立记录就保持 null，不偷换。
    liver_iron: null,
    thyroid: latest('screening_item', 'done_date', "AND item_text LIKE '%甲状腺%'"),
    ogtt: latest('screening_item', 'done_date', "AND (item_text LIKE '%糖耐%' OR item_text LIKE '%OGTT%' OR item_text LIKE '%血糖%')"),
    cardiac_function: latest('screening_item', 'done_date', "AND (item_text LIKE '%心脏超声%' OR item_text LIKE '%心功能%')"),
  }
  return cadenceSnapshotFromFacts({
    birth_date: profile.birth_date, dx_date: profile.dx_date, transfusion_start: profile.transfusion_start, records,
  }, asOf, profileId)
}
