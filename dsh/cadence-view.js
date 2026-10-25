/* HTTP 读视图：只返回可序列化的参考节点，不生成预约或医嘱。 */
import { CADENCE, BAND_DAYS, addMonths, daysSinceLast } from './cadence.js'

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
}

export function cadenceSnapshot(db, profileId, asOf = new Date().toISOString().slice(0, 10)) {
  if (!validDate(asOf)) throw Object.assign(new Error('as_of 必须是有效的 YYYY-MM-DD'), { status: 400 })
  const profile = db.prepare('SELECT * FROM profile WHERE id = ?').get(profileId)
  if (!profile) throw Object.assign(new Error('档案不存在：' + profileId), { status: 404 })
  const clean = (v) => validDate(v) ? v : null
  const latest = (table, column = 'date', condition = '', args = []) => clean(db.prepare(`SELECT MAX(${column}) AS date FROM ${table} WHERE profile_id = ? ${condition} AND ${column} <= ?`).get(profileId, ...args, asOf).date)
  const records = {
    ferritin: latest('iron_lab'), growth: latest('growth_measure'),
    t2star_cardiac: latest('t2star_report', 'date', 'AND organ = ?', ['heart']),
    // 肝铁 LIC 不与肝 T2* 偷换概念；无明确记录映射时保持 null。
    liver_iron: null,
  }
  const checks = CADENCE.checks.map((check) => {
    const rule = check.start || (check.start_age_years ? `age_${check.start_age_years}` : null)
    let start = null
    let startNote = null
    if (rule === 'transfusion_start') start = clean(profile.transfusion_start)
    else if (rule === 'birth') start = clean(profile.birth_date)
    else if (/^age_\d+$/.test(rule || '') && clean(profile.birth_date)) start = addMonths(profile.birth_date, Number(rule.slice(4)) * 12)
    else if (rule === 'age_9_or_transfusion_year_7') startNote = '复合起点规则尚未确认取值口径，不自动选择起点'
    if (!start && !startNote) startNote = '起点事实未记录或无有效日期'
    const interval = check.interval_months
    const dates = []
    if (start && Number.isFinite(interval) && interval > 0 && start <= asOf) {
      // 从规则起点推导，不以最近一次记录重置节奏；仅显示最近四个已到参考节点。
      const elapsed = (Number(asOf.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(asOf.slice(5, 7)) - Number(start.slice(5, 7))
      const end = Math.floor(elapsed / interval)
      for (let k = Math.max(1, end - 4); k <= end; k++) {
        const date = addMonths(start, k * interval)
        if (date <= asOf) dates.push(date)
      }
      if (dates.length > 4) dates.shift()
    }
    const last = records[check.code] || null
    return {
      code: check.code, label: check.label, interval_months: interval,
      ref: check.ref, confidence: check.confidence, alternates: check.alternates || [],
      start_rule: rule, start_date: start, start_note: startNote,
      dates, last_date: last, days_since: daysSinceLast(last, asOf),
      band_days: BAND_DAYS, reference_only: true,
      note: check.note || null,
    }
  })
  return { profile_id: profileId, as_of: asOf, checks, band_note: CADENCE.band_note, documents: CADENCE.documents,
    reference_note: '节点仅作参考，不是预约、医嘱或该检查的提醒；没有记录不代表没有做。' }
}
