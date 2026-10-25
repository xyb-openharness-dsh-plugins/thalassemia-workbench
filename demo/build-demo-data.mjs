#!/usr/bin/env node
/**
 * demo/build-demo-data.mjs —— 演示数据**唯一源**（starter 04/14 号）。
 *
 * 产出两件东西，必须同源：
 *   1. demo/demo-data.sqlite   （按 schema/0001_initial.sql 建的演示库）
 *   2. prototypes/v0.2/demo-data.js （window.DEMO_DATA，供 file:// 原型直接打开）
 *
 * 被 import 时只导出纯数据函数 buildDemoProfiles()，**不碰磁盘**（检查器会 import 它）。
 * 重跑必须字节一致：所有"随机"都用固定种子，时间窗口固定 DATA_END。
 *
 *   node demo/build-demo-data.mjs            # 写两个产物
 *   node demo/build-demo-data.mjs --check    # 只比对产物是否与现有一致（CI 用）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
export const DATA_END = '2026-10-25'
export const WINDOW_MONTHS = 6

/* ---------------- 固定种子随机（保证重跑字节一致） ---------------- */
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/* ---------------- 日期工具（只做加减，不引入时区库） ---------------- */
function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00+08:00')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function addMonthsClamped(iso, months) {
  const [y, m, day] = iso.split('-').map(Number)
  const total = (y * 12 + (m - 1)) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12 + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  const nd = Math.min(day, last) // 月末夹取：1/31 + 1 月 = 2 月末
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00+08:00') - new Date(a + 'T00:00:00+08:00')) / 86400000)
}

/* ---------------- 页面树（唯一源 src/pages.json） ---------------- */
function loadPages() {
  return JSON.parse(readFileSync(join(ROOT, 'src/pages.json'), 'utf8')).pages
}

/* ---------------- 两个档案 ---------------- */
function profileA() {
  const rnd = seeded(20261025)
  const transfusions = []
  // 每 18–21 天一次，从窗口起点排到 DATA_END 前
  let d = addDays(DATA_END, -178)
  let n = 0
  while (d <= DATA_END) {
    n += 1
    transfusions.push({
      date: d,
      hb_before: Math.round(74 + rnd() * 9),
      units: 2,
      volume_ml: null,
      product_type: n % 4 === 0 ? '去白红细胞（洗涤）' : '去白红细胞',
      reaction_text: n === 3 ? '输注约 40 分钟后出现皮疹，减慢滴速后缓解（护士记录）' : '无',
      site: n % 2 === 0 ? '市儿童医院 血液科日间病房' : '市儿童医院 血液科',
      note: null,
    })
    d = addDays(d, 18 + Math.floor(rnd() * 4))
  }
  const iron = [
    ['2026-04-28', 2410], ['2026-05-26', 2580], ['2026-06-23', 2690],
    ['2026-07-21', 3120], ['2026-08-18', 3050], ['2026-09-15', 3610], ['2026-10-13', 3820],
  ].map(([date, v]) => ({
    date, ferritin: v, ref_low: null, ref_high: 500,
    lab_name: '市儿童医院 检验科', report_text: `血清铁蛋白 ${v} ng/mL（参考区间 15–500）`,
  }))
  const growth = [
    ['2026-04-28', 112.4, 18.6], ['2026-05-26', 113.0, 18.9], ['2026-06-23', 113.8, 19.3],
    ['2026-07-21', 114.5, 19.6], ['2026-08-18', 115.4, 20.1], ['2026-09-15', 116.2, 20.4],
    ['2026-10-13', 117.0, 20.8],
  ].map(([date, h, w]) => ({ date, height_cm: h, weight_kg: w, age_months: 79, note: null }))
  const screening = [
    { item_text: '心铁 T2* MRI', category: 'cardiac', planned_date: '2026-11-10', done_date: '2025-11-03', result_text: '心 T2* 18.6 ms（放射科报告原文）', source_text: '2025-11 血液科门诊：每年一次' },
    { item_text: '肝铁 T2* MRI', category: 'cardiac', planned_date: '2026-11-10', done_date: null, result_text: null, source_text: '同上' },
    { item_text: '空腹血糖 + OGTT', category: 'endocrine', planned_date: '2026-12-01', done_date: '2026-06-23', result_text: '空腹 4.9 mmol/L（报告原文）', source_text: '出院小结：半年一次' },
    { item_text: '甲状腺功能（TSH/FT4）', category: 'endocrine', planned_date: null, done_date: '2026-05-26', result_text: 'TSH 2.4 mIU/L（报告原文）', source_text: '门诊医嘱' },
    { item_text: '性腺评估（青春期启动）', category: 'endocrine', planned_date: null, done_date: null, result_text: null, source_text: '医生：等 8 岁后再评估' },
    { item_text: '心脏超声（LVEF/TAPSE）', category: 'cardiac', planned_date: '2026-11-10', done_date: '2025-11-03', result_text: 'LVEF 68%，TAPSE 19 mm（报告原文）', source_text: '年度随访' },
    { item_text: '乙肝 / 丙肝 / HIV 筛查', category: 'infection', planned_date: '2027-01-05', done_date: '2026-01-06', result_text: '均阴性（报告原文）', source_text: '输血前年度筛查' },
    { item_text: '骨密度（双能 X 线）', category: 'endocrine', planned_date: null, done_date: null, result_text: null, source_text: '未安排' },
  ]
  const antibodies = [
    { date: '2025-09-12', antibody_text: '抗体筛查：未检出', crossmatch_text: '主侧 / 次侧均相合', note: null },
    { date: '2026-06-23', antibody_text: '抗体筛查：未检出', crossmatch_text: '主侧 / 次侧均相合', note: '本次配血等待 4 小时' },
  ]
  const costs = [
    { date: '2026-08-18', category: 'transfusion', amount_cents: 128000, insurance_flag: 'insured', note: '2U 去白红细胞 + 输血费' },
    { date: '2026-08-18', category: 'chelation', amount_cents: 96000, insurance_flag: 'insured', note: '地拉罗司 1 个月' },
    { date: '2026-09-15', category: 'transfusion', amount_cents: 131000, insurance_flag: 'insured', note: null },
    { date: '2026-09-15', category: 'chelation', amount_cents: 96000, insurance_flag: 'insured', note: null },
    { date: '2026-09-20', category: 'other', amount_cents: 26000, insurance_flag: 'self_pay', note: '往返交通 + 住宿' },
    { date: '2026-10-13', category: 'transfusion', amount_cents: 129500, insurance_flag: 'insured', note: null },
  ]
  const questions = [
    { text: '这次铁蛋白比上次高，是加药还是继续观察？', source_page: 'iron', status: 'open' },
    { text: '孩子比同班同学矮，需要查生长激素吗？', source_page: 'growth', status: 'open' },
    { text: '心铁 T2* 比去年低了一点，需要提前复查吗？', source_page: 'screening', status: 'open' },
  ]
  const docs = [
    { filename: '2026-10-13 血常规.pdf', kind: 'lab', date: '2026-10-13' },
    { filename: '2026-10-13 铁蛋白化验单.jpg', kind: 'lab', date: '2026-10-13' },
    { filename: '2025-11-03 心肝铁T2星.pdf', kind: 'report', date: '2025-11-03' },
    { filename: '2024-02-18 基因检测报告.pdf', kind: 'report', date: '2024-02-18' },
  ]
  const candidates = [
    { field: 'ferritin', value: '3820', status: 'pending', page: 'iron', note: '来自 2026-10-13 铁蛋白化验单' },
    { field: 'hb_before', value: '81', status: 'pending', page: 'transfusion', note: '来自 2026-10-13 血常规' },
    { field: 't2star_heart', value: '18.6', status: 'accepted', page: 'iron', note: '来自 2025-11-03 T2* 报告' },
  ]
  return {
    id: 'A',
    name: '小宇',
    relation: 'caregiver',
    recorder: '妈妈（代记）',
    sex: '男',
    age: 6,
    birth_date: '2020-03-14',
    meta: '重型 β 地贫（β0/β0）· 6 岁 · 输血依赖 4 年 7 个月',
    headline: '每 3 周输一次血，晚上睡前打 10 小时去铁泵；妈妈在记，孩子在被记。',
    genotype: 'β0/β0（2024-02-18 基因检测报告原文）',
    dx_date: '2021-05-08',
    transfusion_start: '2021-06-12',
    mindset: '最担心孩子比同学矮、以及"铁到底排干净了没有"。',
    dash_keys: ['hb', 'ferritin', 'height'],
    transfusions, iron, growth, screening, antibodies, costs, questions, docs, candidates,
  }
}

function profileB() {
  const rnd = seeded(20261026)
  const transfusions = []
  let d = addDays(DATA_END, -176)
  let n = 0
  while (d <= DATA_END) {
    n += 1
    transfusions.push({
      date: d, hb_before: Math.round(76 + rnd() * 8), units: 2, volume_ml: null,
      product_type: '去白红细胞', reaction_text: '无',
      site: n % 2 ? '区中心医院 输血科' : '区中心医院 血液科', note: null,
    })
    d = addDays(d, 24 + Math.floor(rnd() * 3))
  }
  const iron = [
    ['2026-05-02', 1420], ['2026-06-06', 1310], ['2026-07-11', 1180],
    ['2026-08-15', 1090], ['2026-09-19', 980], ['2026-10-24', 940],
  ].map(([date, v]) => ({
    date, ferritin: v, ref_low: null, ref_high: 300,
    lab_name: '区中心医院 检验科', report_text: `铁蛋白 ${v} µg/L（参考 13–300）`,
  }))
  const growth = [
    ['2026-05-02', 158.2, 47.1], ['2026-07-11', 158.2, 46.8], ['2026-09-19', 158.3, 47.4],
  ].map(([date, h, w]) => ({ date, height_cm: h, weight_kg: w, age_months: 292, note: '成年，身高已稳定' }))
  const screening = [
    { item_text: '心铁 T2* MRI', category: 'cardiac', planned_date: '2026-12-20', done_date: '2026-01-18', result_text: '心 T2* 26.1 ms（报告原文）', source_text: '血液科门诊：每年' },
    { item_text: '肝铁 T2* MRI', category: 'cardiac', planned_date: '2026-12-20', done_date: '2026-01-18', result_text: '肝铁 3.1 mg/g dw（报告原文）', source_text: '同上' },
    { item_text: '空腹血糖 + OGTT', category: 'endocrine', planned_date: null, done_date: '2026-09-19', result_text: '空腹 5.4 mmol/L（报告原文）', source_text: '年度体检' },
    { item_text: '心脏超声', category: 'cardiac', planned_date: null, done_date: '2026-01-18', result_text: 'LVEF 62%（报告原文）', source_text: '年度随访' },
    { item_text: '听力检查（去铁酮相关）', category: 'endocrine', planned_date: '2026-11-30', done_date: null, result_text: null, source_text: '医生：服去铁酮期间每 6–12 月' },
    { item_text: '乙肝 / 丙肝 / HIV 筛查', category: 'infection', planned_date: null, done_date: '2026-03-08', result_text: '均阴性（报告原文）', source_text: '年度筛查' },
  ]
  const antibodies = [
    { date: '2026-03-08', antibody_text: '抗体筛查：抗-E 可疑（原文）', crossmatch_text: '主侧相合，次侧弱凝集（原文）', note: '需复查' },
  ]
  const costs = [
    { date: '2026-09-19', category: 'transfusion', amount_cents: 86000, insurance_flag: 'insured', note: null },
    { date: '2026-09-19', category: 'chelation', amount_cents: 42000, insurance_flag: 'self_pay', note: '去铁酮自费部分' },
    { date: '2026-10-15', category: 'transfusion', amount_cents: 88000, insurance_flag: 'insured', note: null },
  ]
  const questions = [
    { text: '抗-E 可疑需要提前配血吗？', source_page: 'transfusion', status: 'open' },
    { text: '去铁酮吃了 3 年，听力要不要停一段时间再查？', source_page: 'screening', status: 'open' },
  ]
  const docs = [
    { filename: '2026-10-24 铁蛋白.pdf', kind: 'lab', date: '2026-10-24' },
    { filename: '2026-01-18 心肝铁T2星.pdf', kind: 'report', date: '2026-01-18' },
  ]
  const candidates = [
    { field: 'ferritin', value: '940', status: 'pending', page: 'iron', note: '来自 2026-10-24 铁蛋白报告' },
  ]
  return {
    id: 'B',
    name: '阿岚',
    relation: 'self',
    recorder: '本人',
    sex: '女',
    age: 24,
    birth_date: '2002-04-09',
    meta: '重型 β 地贫 · 24 岁 · 输血依赖 22 年 · 已工作',
    headline: '每 4 周请半天假去输血；去铁药自己买、自己算钱。',
    genotype: 'β+/β+（2019 年复核，报告原文）',
    dx_date: '2004-06-01',
    transfusion_start: '2004-07-15',
    mindset: '最担心请假太多被领导知道，还有能不能自己生小孩。',
    dash_keys: ['hb', 'ferritin', 'cost'],
    transfusions, iron, growth, screening, antibodies, costs, questions, docs, candidates,
  }
}

/* ---------------- 组装：series / events 派生（不落库） ---------------- */
function assemble(p) {
  const series = {
    hb: p.transfusions.map((t) => ({ d: t.date, v: t.hb_before })),
    ferritin: p.iron.map((t) => ({ d: t.date, v: t.ferritin })),
    height: p.growth.map((t) => ({ d: t.date, v: t.height_cm })),
  }
  const events = [
    ...p.transfusions.map((t) => ({ d: t.date, kind: 'transfusion', label: `输血 ${t.units}U` })),
    ...p.iron.map((t) => ({ d: t.date, kind: 'lab', label: '铁蛋白复查' })),
  ].sort((a, b) => (a.d < b.d ? -1 : 1))
  const intervals = p.transfusions.slice(1).map((t, i) => daysBetween(p.transfusions[i].date, t.date))
  const last = p.transfusions[p.transfusions.length - 1]
  const nextDue = addDays(last.date, 20)
  const monthly = {}
  for (const c of p.costs) {
    const m = c.date.slice(0, 7)
    monthly[m] = monthly[m] || { transfusion: 0, chelation: 0, other: 0 }
    if (c.amount_cents !== null) monthly[m][c.category] += c.amount_cents
  }
  return {
    profile: {
      id: p.id, name: p.name, relation: p.relation, recorder: p.recorder, sex: p.sex, age: p.age,
      meta: p.meta, headline: p.headline, genotype: p.genotype, birth_date: p.birth_date,
      dx_date: p.dx_date, transfusion_start: p.transfusion_start, mindset: p.mindset, dash_keys: p.dash_keys,
    },
    transfusion: {
      section_title: '输血记录',
      rows: p.transfusions.map((t) => [t.date, String(t.hb_before), `${t.units}U`, t.product_type, t.reaction_text, t.site]),
      summary: {
        count: p.transfusions.length,
        last_date: last.date,
        days_since: daysBetween(last.date, DATA_END),
        next_due: nextDue,
        intervals,
        median_interval: [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)] ?? null,
      },
    },
    iron: {
      section_title: '铁蛋白趋势',
      rows: p.iron.map((t) => [t.date, String(t.ferritin), 'ng/mL', t.report_text]),
      plan: p.id === 'A'
        ? [{ drug: '地拉罗司（分散片）', dose: '按体重调整，医嘱原文：20 mg/kg 每日一次', route: 'oral', start: '2026-03-02', end: null, reason: '因胃肠道反应由去铁胺调整为口服' }]
        : [{ drug: '去铁酮', dose: '医嘱原文：25 mg/kg 每日三次', route: 'oral', start: '2023-04-11', end: null, reason: '夜间泵影响上班，改为口服' }],
      t2star: p.id === 'A'
        ? [{ date: '2025-11-03', organ: 'heart', value: 18.6, report: '心 T2* 18.6 ms（放射科报告原文）' }]
        : [{ date: '2026-01-18', organ: 'heart', value: 26.1, report: '心 T2* 26.1 ms（放射科报告原文）' },
           { date: '2026-01-18', organ: 'liver', value: null, report: '肝铁 3.1 mg/g dw（报告原文）' }],
    },
    growth: { section_title: '身高体重', rows: p.growth.map((g) => [g.date, String(g.height_cm), String(g.weight_kg), g.note || '']) },
    screening: { section_title: '筛查清单', rows: p.screening.map((s) => [s.item_text, s.category, s.planned_date || '—', s.done_date || '—', s.result_text || '—', s.source_text]) },
    antibody: { section_title: '抗体与配血', rows: p.antibodies.map((a) => [a.date, a.antibody_text, a.crossmatch_text, a.note || '']) },
    cost: { section_title: '费用记录', rows: p.costs.map((c) => [c.date, c.category, c.amount_cents === null ? '—' : (c.amount_cents / 100).toFixed(2), c.insurance_flag, c.note || '']), monthly },
    questions: { section_title: '就诊问题', rows: p.questions.map((q) => [q.text, q.source_page, q.status]) },
    docs: p.docs,
    candidates: p.candidates,
    series,
    events,
  }
}

export function buildDemoProfiles() {
  return { pages: loadPages(), dataEnd: DATA_END, windowMonths: WINDOW_MONTHS, profiles: { A: profileA(), B: profileB() } }
}

export function buildDemoBundle() {
  const raw = buildDemoProfiles()
  return {
    data_end: DATA_END,
    window_months: WINDOW_MONTHS,
    pages: raw.pages,
    profiles: { A: assemble(raw.profiles.A), B: assemble(raw.profiles.B) },
  }
}

/* ---------------- 写库（按 schema/0001_initial.sql 建表） ---------------- */
async function writeSqlite(bundle, outPath) {
  const { DatabaseSync } = await import('node:sqlite')
  mkdirSync(dirname(outPath), { recursive: true })
  if (existsSync(outPath)) rmSync(outPath)
  const db = new DatabaseSync(outPath)
  const ddl = readFileSync(join(ROOT, 'schema/0001_initial.sql'), 'utf8')
  db.exec(ddl)
  db.exec('BEGIN')
  for (const key of ['A', 'B']) {
    const p = bundle.profiles[key]
    const raw = buildDemoProfiles().profiles[key]
    db.prepare(`INSERT INTO profile (id,display_name,relation,sex,birth_date,dx_date,genotype_text,transfusion_start,note,section_title,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      p.profile.id, p.profile.name, p.profile.relation, p.profile.sex === '男' ? 'male' : 'female',
      p.profile.birth_date, p.profile.dx_date, p.profile.genotype, p.profile.transfusion_start, p.profile.mindset,
      '病情档案', DATA_END + 'T00:00:00+08:00', DATA_END + 'T00:00:00+08:00',
    )
    const ti = db.prepare(`INSERT INTO transfusion (id,profile_id,date,hb_before,units,volume_ml,product_type,reaction_text,site,note,section_title,created_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    raw.transfusions.forEach((t, i) => ti.run(`${key}-T${i + 1}`, key, t.date, t.hb_before, t.units, null, t.product_type, t.reaction_text, t.site, null, '输血记录', t.date + 'T00:00:00+08:00'))
    const ii = db.prepare(`INSERT INTO iron_lab (id,profile_id,date,ferritin,ref_low,ref_high,lab_name,report_text,section_title,created_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?)`)
    raw.iron.forEach((t, i) => ii.run(`${key}-I${i + 1}`, key, t.date, t.ferritin, null, t.ref_high, t.lab_name, t.report_text, '铁蛋白趋势', t.date + 'T00:00:00+08:00'))
    const gi = db.prepare(`INSERT INTO growth_measure (id,profile_id,date,height_cm,weight_kg,age_months,note,section_title,created_at)
                           VALUES (?,?,?,?,?,?,?,?,?)`)
    raw.growth.forEach((g, i) => gi.run(`${key}-G${i + 1}`, key, g.date, g.height_cm, g.weight_kg, g.age_months, g.note, '身高体重', g.date + 'T00:00:00+08:00'))
    const si = db.prepare(`INSERT INTO screening_item (id,profile_id,item_text,category,planned_date,done_date,result_text,source_text,section_title,created_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?)`)
    raw.screening.forEach((s, i) => si.run(`${key}-S${i + 1}`, key, s.item_text, s.category, s.planned_date, s.done_date, s.result_text, s.source_text, '筛查清单', DATA_END + 'T00:00:00+08:00'))
    const ai = db.prepare(`INSERT INTO antibody_record (id,profile_id,date,antibody_text,crossmatch_text,note,section_title,created_at)
                           VALUES (?,?,?,?,?,?,?,?)`)
    raw.antibodies.forEach((a, i) => ai.run(`${key}-AB${i + 1}`, key, a.date, a.antibody_text, a.crossmatch_text, a.note, '抗体与配血', a.date + 'T00:00:00+08:00'))
    const ci = db.prepare(`INSERT INTO cost_record (id,profile_id,date,category,amount_cents,insurance_flag,note,section_title,created_at)
                           VALUES (?,?,?,?,?,?,?,?,?)`)
    raw.costs.forEach((c, i) => ci.run(`${key}-C${i + 1}`, key, c.date, c.category, c.amount_cents, c.insurance_flag, c.note, '费用记录', c.date + 'T00:00:00+08:00'))
    const qi = db.prepare(`INSERT INTO question_item (id,profile_id,text,source_page,status,created_at,section_title)
                           VALUES (?,?,?,?,?,?,?)`)
    raw.questions.forEach((q, i) => qi.run(`${key}-Q${i + 1}`, key, q.text, q.source_page, q.status, DATA_END + 'T00:00:00+08:00', '就诊问题'))
    const di = db.prepare(`INSERT INTO docs (id,profile_id,filename,kind,sha256,imported_at,note,section_title)
                           VALUES (?,?,?,?,?,?,?,?)`)
    raw.docs.forEach((d, i) => di.run(`${key}-D${i + 1}`, key, d.filename, d.kind, createHash('sha256').update(`${key}${d.filename}`).digest('hex'), d.date + 'T00:00:00+08:00', null, '资料库'))
    const ki = db.prepare(`INSERT INTO candidates (id,doc_id,profile_id,field,value,status,page_no,created_at,note)
                           VALUES (?,?,?,?,?,?,?,?,?)`)
    raw.candidates.forEach((c, i) => ki.run(`${key}-K${i + 1}`, null, key, c.field, c.value, c.status, 1, DATA_END + 'T00:00:00+08:00', c.note))
    // metrics：数值型 + 一个分类序列（证明"分类不进趋势"）
    const mi = db.prepare(`INSERT INTO metrics (id,profile_id,kind,code,date,value_num,value_text,unit,ref_low,ref_high,dec,ord,in_use,note,created_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    p.series.hb.forEach((x, i) => mi.run(`${key}-M-hb-${i}`, key, 'numeric', 'hb', x.d, x.v, null, 'g/L', null, null, null, null, 1, null, DATA_END + 'T00:00:00+08:00'))
    p.series.ferritin.forEach((x, i) => mi.run(`${key}-M-ft-${i}`, key, 'numeric', 'ferritin', x.d, x.v, null, 'ng/mL', null, null, null, null, 1, null, DATA_END + 'T00:00:00+08:00'))
    p.series.height.forEach((x, i) => mi.run(`${key}-M-ht-${i}`, key, 'numeric', 'height', x.d, x.v, null, 'cm', null, null, null, null, 1, null, DATA_END + 'T00:00:00+08:00'))
    ;(p.id === 'A' ? ['确诊', '开始输血', '开始去铁', '换口服去铁'] : ['确诊', '开始输血', '换口服去铁']).forEach((label, i) =>
      mi.run(`${key}-M-q-${i}`, key, 'qual', 'milestone', addDays(DATA_END, -300 + i * 40), null, label, null, null, null, label, i, 1, null, DATA_END + 'T00:00:00+08:00'))
  }
  db.exec('COMMIT')
  const counts = {}
  for (const t of ['profile', 'transfusion', 'iron_lab', 'growth_measure', 'screening_item', 'antibody_record', 'cost_record', 'question_item', 'docs', 'candidates', 'metrics']) {
    counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
  }
  db.close()
  return counts
}

/* ---------------- 主流程 ---------------- */
async function main() {
  const check = process.argv.includes('--check')
  const bundle = buildDemoBundle()
  const sqlitePath = join(ROOT, 'demo/demo-data.sqlite')
  const jsPath = join(ROOT, 'prototypes/v0.2/demo-data.js')
  const js = '/* 由 demo/build-demo-data.mjs 生成；勿手改。改数据请改生成器后重跑。 */\n' +
    'window.DEMO_DATA = ' + JSON.stringify(bundle) + ';\n'

  if (check) {
    const prev = existsSync(jsPath) ? readFileSync(jsPath, 'utf8') : ''
    if (prev !== js) { console.error('demo-data.js 与生成器不一致，请重跑 `npm run build:demo`'); process.exit(1) }
    console.log('demo-data.js 一致（' + js.length + ' 字节）')
    return
  }

  mkdirSync(dirname(jsPath), { recursive: true })
  writeFileSync(jsPath, js)
  const counts = await writeSqlite(bundle, sqlitePath)
  console.log(JSON.stringify({ ok: true, sqlite: sqlitePath, demoJs: jsPath, bytes: js.length, counts }, null, 2))
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*?(?=\/)/, ''))) {
  await main()
}
