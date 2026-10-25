/* 读模型：把库里的行还原成 **demo-data.js 同一形状**（parity 是这一层唯一验收标准）。
 *
 * 三条硬规则：
 * 1. 有 ord 按 ord（不叠 DESC）；没有 ord 的复合主键表按 rowid。
 * 2. 分类值走 dec，且**不补 unit 键**——原型里分类没有 unit，多补一个键 parity 就红。
 * 3. 派生值读取时算（输血间隔中位数、距今天数、下次预约、月度聚合），**不落库**。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PAGES = JSON.parse(readFileSync(fileURLToPath(new URL('../src/pages.json', import.meta.url)), 'utf8')).pages
const WINDOW_MONTHS = 6

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00+08:00')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00+08:00') - new Date(a + 'T00:00:00+08:00')) / 86400000)

const rows = (db, sql, ...args) => db.prepare(sql).all(...args)

function profileMeta(p) {
  return {
    id: p.id,
    name: p.display_name,
    relation: p.relation,
    recorder: p.relation === 'caregiver' ? '家长代记' : '本人',
    sex: p.sex === 'male' ? '男' : p.sex === 'female' ? '女' : '未知',
    age: p.birth_date ? Math.floor(daysBetween(p.birth_date, '2026-10-25') / 365.25) : null,
    meta: p.meta_text || p.note || '',
    headline: p.headline_text || '',
    genotype: p.genotype_text,
    birth_date: p.birth_date,
    dx_date: p.dx_date,
    transfusion_start: p.transfusion_start,
    mindset: p.mindset_text || '',
    dash_keys: p.dash_keys ? JSON.parse(p.dash_keys) : ['hb', 'ferritin', 'height'],
  }
}

/** 一个档案的完整读模型。 */
export function profileBundle(db, id, { dataEnd = new Date().toISOString().slice(0, 10) } = {}) {
  const p = db.prepare('SELECT * FROM profile WHERE id = ?').get(id)
  if (!p) return null

  const transfusions = rows(db, 'SELECT * FROM transfusion WHERE profile_id = ? ORDER BY date ASC, rowid ASC', id)
  const iron = rows(db, 'SELECT * FROM iron_lab WHERE profile_id = ? ORDER BY date ASC, rowid ASC', id)
  const growth = rows(db, 'SELECT * FROM growth_measure WHERE profile_id = ? ORDER BY date ASC, rowid ASC', id)
  const screening = rows(db, 'SELECT * FROM screening_item WHERE profile_id = ? ORDER BY rowid ASC', id)
  const antibodies = rows(db, 'SELECT * FROM antibody_record WHERE profile_id = ? ORDER BY date ASC, rowid ASC', id)
  const costs = rows(db, 'SELECT * FROM cost_record WHERE profile_id = ? ORDER BY date ASC, rowid ASC', id)
  const questions = rows(db, 'SELECT * FROM question_item WHERE profile_id = ? ORDER BY rowid ASC', id)
  const docs = rows(db, 'SELECT * FROM docs WHERE profile_id = ? ORDER BY rowid ASC', id)
  const candidates = rows(db, 'SELECT * FROM candidates WHERE profile_id = ? ORDER BY rowid ASC', id)
  const plans = rows(db, 'SELECT * FROM chelation_plan WHERE profile_id = ? ORDER BY start_date ASC, rowid ASC', id)
  const t2star = rows(db, 'SELECT * FROM t2star_report WHERE profile_id = ? ORDER BY date ASC, rowid ASC', id)

  const series = {
    hb: transfusions.filter((t) => t.hb_before !== null).map((t) => ({ d: t.date, v: t.hb_before })),
    ferritin: iron.filter((t) => t.ferritin !== null).map((t) => ({ d: t.date, v: t.ferritin })),
    height: growth.filter((g) => g.height_cm !== null).map((g) => ({ d: g.date, v: g.height_cm })),
  }

  const events = [
    ...transfusions.map((t) => ({ d: t.date, kind: 'transfusion', label: `输血 ${t.units ?? '—'}U` })),
    ...iron.map((t) => ({ d: t.date, kind: 'lab', label: '铁蛋白复查' })),
  ].sort((a, b) => (a.d < b.d ? -1 : 1))

  const intervals = transfusions.slice(1).map((t, i) => daysBetween(transfusions[i].date, t.date))
  const sorted = [...intervals].sort((a, b) => a - b)
  const last = transfusions[transfusions.length - 1]

  const monthly = {}
  for (const c of costs) {
    const m = c.date.slice(0, 7)
    monthly[m] = monthly[m] || { transfusion: 0, chelation: 0, other: 0 }
    if (c.amount_cents !== null) monthly[m][c.category] += c.amount_cents
  }

  return {
    profile: profileMeta(p),
    transfusion: {
      section_title: transfusions[0]?.section_title || '输血记录',
      rows: transfusions.map((t) => [t.date, t.hb_before === null ? '—' : String(t.hb_before),
        t.units === null ? '—' : `${t.units}U`, t.product_type || '', t.reaction_text || '', t.site || '']),
      summary: {
        count: transfusions.length,
        last_date: last?.date || null,
        days_since: last ? daysBetween(last.date, dataEnd) : null,
        next_due: last ? addDays(last.date, 20) : null,
        intervals,
        median_interval: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
      },
    },
    iron: {
      section_title: iron[0]?.section_title || '铁蛋白趋势',
      rows: iron.map((t) => [t.date, t.ferritin === null ? '—' : String(t.ferritin), 'ng/mL', t.report_text || '']),
      plan: plans.map((x) => ({ drug: x.drug_text, dose: x.dose_text, route: x.route, start: x.start_date, end: x.end_date, reason: x.change_reason })),
      t2star: t2star.map((x) => ({ date: x.date, organ: x.organ, value: x.t2star_ms, report: x.report_text })),
    },
    growth: {
      section_title: growth[0]?.section_title || '身高体重',
      rows: growth.map((g) => [g.date, g.height_cm === null ? '—' : String(g.height_cm),
        g.weight_kg === null ? '—' : String(g.weight_kg), g.note || '']),
    },
    screening: {
      section_title: screening[0]?.section_title || '筛查清单',
      rows: screening.map((s) => [s.item_text, s.category, s.planned_date || '—', s.done_date || '—',
        s.result_text || '—', s.source_text || '']),
    },
    antibody: {
      section_title: antibodies[0]?.section_title || '抗体与配血',
      rows: antibodies.map((a) => [a.date, a.antibody_text || '', a.crossmatch_text || '', a.note || '']),
    },
    cost: {
      section_title: costs[0]?.section_title || '费用记录',
      rows: costs.map((c) => [c.date, c.category, c.amount_cents === null ? '—' : (c.amount_cents / 100).toFixed(2),
        c.insurance_flag || '', c.note || '']),
      monthly,
    },
    questions: {
      section_title: questions[0]?.section_title || '就诊问题',
      rows: questions.map((q) => [q.text, q.source_page || '', q.status]),
    },
    docs: docs.map((d) => ({ filename: d.filename, kind: d.kind, date: (d.imported_at || '').slice(0, 10) })),
    candidates: candidates.map((c) => ({ field: c.field, value: c.value, status: c.status, page: 'records', note: c.note || '' })),
    series,
    events,
  }
}

/** 整个应用需要的形状：public/app.js 直接把它当 window.DEMO_DATA 用（与原型同构）。 */
export function bootstrap(db, { dataEnd = '2026-10-25', version = '0.0.0' } = {}) {
  const ids = rows(db, 'SELECT id FROM profile ORDER BY rowid ASC').map((r) => r.id)
  const profiles = {}
  for (const id of ids) profiles[id] = profileBundle(db, id, { dataEnd })
  return {
    data_end: dataEnd,
    window_months: WINDOW_MONTHS,
    pages: PAGES,
    profiles,
    version,
  }
}

export function getProfile(db, id) {
  const p = db.prepare('SELECT * FROM profile WHERE id = ?').get(id)
  return p ? profileMeta(p) : null
}

export { PAGES }
