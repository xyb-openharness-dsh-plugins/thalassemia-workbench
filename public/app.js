/* 小铁宝 FerroPal · 原型 v0.2
 *
 * 约定（写在这里，评审按此走查）：
 * 1. 演示数据唯一源 = demo/build-demo-data.mjs → demo-data.js，本文件不造数据，只读 window.DEMO_DATA。
 * 2. 页面树唯一源 = src/pages.json（经 demo-data.js 注入），本文件不手写第二份。
 * 3. 不判读：全文件不出现判读类措辞（见 scripts/check-wording.mjs 的词表），也不计算级别。 // wording-allow
 * 4. 分类序列只画节点不连线；数值曲线走 Fritsch–Carlson 单调三次插值。
 * 5. 每条功能线挂一句患者原话（VOICE），证据状态 hypothesis（本轮 0 访谈），界面必须显示"假设句"徽章。
 */
'use strict'

let DATA = window.DEMO_DATA
const PAGES = DATA.pages
const VERSION = 'v0.4.3'
const BUILD = '2026-10-25'

const state = {
  profile: 'A',
  view: 'dashboard',
  sub: {},
  flipped: {},
  folds: {},
  font: 'std',
  pageview: null,
  series: { hb: true, ferritin: true, height: false },
  privateOpen: false,
  saved: [],
}

/* ---------------- 小工具 ---------------- */
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
/** 空值先挡 null/undefined/'' 再 Number()——Number(null) === 0 会把"没填"变成 0。 */
const numOrNull = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(v))
const P = () => DATA.profiles[state.profile]
const today = () => DATA.data_end
const daysAgo = (iso) => Math.round((new Date(today() + 'T00:00:00+08:00') - new Date(iso + 'T00:00:00+08:00')) / 86400000)

function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => t.classList.remove('show'), 2600)
}

/* ---------------- 患者原话（证据分层，本轮全部 hypothesis） ---------------- */
/* 患者原话位：每条功能线一句。证据状态二选一（本轮无 interview）：
 *   public      —— 公开报道中家长/患者的直接引语，附来源（research/patient-voices.md 编号）
 *   hypothesis  —— 疾病轴推导的假设句，界面必须显示"假设句·未经访谈核实"
 * 规则：public 也不得改写成"我们访谈了 N 位"。 */
const VOICE = {
  dashboard: { status: 'public', text: '「她书包里总放着个小本子，记着下次输血的日子。」', src: '新快报 2025-07-21 · 2.3' },
  transfusion: { status: 'public', text: '「因为血管越来越难找，有时候被扎了四五针才能顺利输血。」', src: '中国新闻网 2017-03-04 · 2.11' },
  iron: { status: 'public', text: '「血液中的铁含量已过万了，我们不得不让她休息，专心做排铁治疗。」', src: '广州日报新花城 2024-01-02 · 2.9' },
  growth: { status: 'public', text: '「她小时候问我，妈妈，为什么弟弟妹妹能跑，我不能？」', src: '新快报 2025-07-21 · 2.2' },
  screening: { status: 'hypothesis', text: '「该查什么全凭医生提醒，换个医院就得重讲一遍。」' },
  genetics: { status: 'hypothesis', text: '「要不要再生一个，这句话我在心里放三年了，不敢问。」' },
  cost: { status: 'public', text: '「这些排铁药都是进口的，像这一盒瑞士进口的，28片2100元，现在一天吃7片，只够吃四天。」', src: '中国新闻网 2017-03-04 · 2.10' },
  glossary: { status: 'hypothesis', text: '「网上说地贫要补铁，我差点就买了。」' },
  nutrition: { status: 'hypothesis', text: '「排铁药和饭到底怎么错开，说法一人一个。」' },
  mind: { status: 'public', text: '「最让我心痛的是，女儿追问『是不是我不够好才会生病？』」', src: '新快报 2025-07-21 · 2.1' },
  records: { status: 'hypothesis', text: '「十年病历在三个医院，每次都要从头讲。」' },
  timeline: { status: 'hypothesis', text: '「我就想知道，他到底是在变好还是变差。」' },
  review: { status: 'hypothesis', text: '「复诊五分钟，出来才想起三个问题没问。」' },
}
const voiceBlock = (view) => {
  const v = VOICE[view] || { status: 'hypothesis', text: '' }
  const badge = v.status === 'public'
    ? `<span class="badge-hypo pub" title="${esc(v.src || '')}">公开叙述 · ${esc((v.src || '').split('·')[0].trim())}</span>`
    : `<span class="badge-hypo" title="本轮 0 访谈，此句为疾病轴推导的假设句，不是一手引语">假设句 · 未经访谈核实</span>`
  return `<div class="voice" role="note">
    <b>患者视角</b>
    <span>${esc(v.text)}</span>
    ${badge}
    ${v.status === 'public' ? `<span class="src">出处：${esc(v.src || '')}（公开报道直接引语，非本项目访谈）</span>` : ''}
  </div>`
}


/* ---------------- G1 出处层（页码来自 TIF 指南 PDF，见 assets/reference/guideline/refs.json） ----------------
   两段式：上=指南原文（版本·页·表），下=你的记录。中间不合成判断，不出现"所以/因此/你需要"。 */
const GUIDE_REFS = {
  'G1-01': { doc: 'TIF TDT 短指南 2nd ed', page: 'P26（印刷 P24）', topic: '输血间隔与输血前 Hb 目标',
    excerpt: '…usually administered every two to five weeks, to maintain the pre-transfusion haemoglobin level 90-105 g/L.' },
  'G1-02': { doc: 'TIF TDT 4th ed 2021', page: 'P44（印刷 P43）', topic: '同一目标的另一套写法',
    excerpt: 'usually administered every two to four weeks, to maintain the pre-transfusion haemoglobin level 95-105 g/l.' },
  'G1-05': { doc: 'TIF TDT 短指南 2nd ed', page: 'P34（印刷 P32）', topic: '铁蛋白监测频率',
    excerpt: 'SF concentration is measured at least every 3 months (1-3 months). Target value is currently between 500-1000 μg/l.' },
  'G1-07': { doc: 'TIF TDT 短指南 2nd ed', page: 'P36 表 2', topic: '心铁 T2* 复查频率',
    excerpt: 'Stable T2* >20 milliseconds: two yearly / T2* 10-19: yearly / T2* <10: 6 monthly' },
  'G1-11': { doc: 'TIF TDT 短指南 2nd ed', page: 'P77（印刷 P75）', topic: '甲状腺筛查起始与频率',
    excerpt: 'Investigation of thyroid function should be performed annually, beginning at the age of 9 years.' },
  'G1-14': { doc: 'TIF TDT 4th ed 2021', page: 'P147（印刷 P146）', topic: '生长测量频率',
    excerpt: "Patients' growth should be assessed every 6 months by accurate measurement of standing and sitting height and weight." },
  'G1-16': { doc: '86 个罕见病病种诊疗指南（2025 年版）#78', page: 'P472（印刷 P466）', topic: '中国口径的输血方案',
    excerpt: '推荐的方案为：①在 Hb<90g/L 时启动输血计划；②每 2～5 周输血 1 次，每次输红细胞 0.5～1U/10kg，时间为 2～4 小时；③通过输血将 Hb 维持在 90～140g/L' },
  'G1-17': { doc: '86 个罕见病病种诊疗指南（2025 年版）#78', page: 'P472（印刷 P466）', topic: '中国口径的祛铁启动与监测',
    excerpt: '当输血≥10 次、血清铁蛋白>1000μg/L 或肝铁浓度>7mg/g 干重时，应启动祛铁治疗，并每月监测血清铁蛋白，每年检测肝铁浓度。' },
  'G1-22': { doc: '86 个罕见病病种诊疗指南（2025 年版）#78', page: 'P473（印刷 P469）', topic: '产前诊断的三个时间窗',
    excerpt: '如夫妇双方均为 β 地贫基因携带者，可于妊娠第 8～12 周吸取绒毛，或妊娠第 16～20 周抽取羊水分离脱落细胞，或妊娠第 20 周后抽取脐带血' },
  'G1-23': { doc: '86 个罕见病病种诊疗指南（2025 年版）#78', page: 'P474（印刷 P470）', topic: '中国口径的生长与内分泌监测',
    excerpt: '推荐患儿 10 岁前开始监测生长发育及内分泌系统水平。建议体格检查与功能状态评估项目：身高、体重、头围、胸围、眼距、骨龄、维生素 D' },
}

/** 两段式出处块：refIds 是 G1 编号数组；mine 是"你的记录"那一行（必须是事实，不是结论）。 */
function guideNote(refIds, mine) {
  const refs = refIds.map((id) => GUIDE_REFS[id]).filter(Boolean)
  if (!refs.length) return ''
  return `<div class="guide">
    <div class="guide-col">
      <span class="eyebrow">指南这里写的是</span>
      ${refs.map((r) => `<p class="gq">“${esc(r.excerpt)}”</p>
        <p class="gmeta">${esc(r.doc)} · ${esc(r.page)} · ${esc(r.topic)}</p>`).join('')}
    </div>
    <div class="guide-col">
      <span class="eyebrow">你的记录是</span>
      <p>${mine}</p>
    </div>
  </div>
  <p class="note-line">两栏并列，中间不做合成判断：指南给的是间隔与区间，你的记录是事实；是否调整由医生决定。</p>`
}

/* ---------------- 图表：Fritsch–Carlson 单调三次插值 ---------------- */
function monotonePath(points) {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x} ${points[0].y}`
  const dx = [], dy = [], m = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
    m.push(dy[i] / (dx[i] || 1))
  }
  const t = new Array(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0
    else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i])
    }
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const x1 = points[i].x, y1 = points[i].y
    const x2 = points[i + 1].x, y2 = points[i + 1].y
    const h = (x2 - x1) / 3
    d += ` C ${(x1 + h).toFixed(2)} ${(y1 + t[i] * h).toFixed(2)}, ${(x2 - h).toFixed(2)} ${(y2 - t[i + 1] * h).toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }
  return d
}

/**
 * 折线图。series: [{key,label,points:[{d,v}],rust}]；events: [{d,kind,label}]
 * 规则：分类事件只画节点不连线；末点标签右移 13px 避让；不画任何阈值线。
 */
function chart({ series, events = [], unit = '', height = 210, showEvents = true }) {
  const W = 640, H = height, padL = 42, padR = 54, padT = 14, padB = 26
  const all = series.flatMap((s) => s.points.map((p) => p.v)).filter((v) => Number.isFinite(v))
  if (!all.length) return `<div class="empty">还没有数据。记一笔就会出现第一个点。</div>`
  let min = Math.min(...all), max = Math.max(...all)
  if (min === max) { min = min - 1; max = max + 1 }
  const span = max - min
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.d)))].sort()
  const t0 = dates[0], t1 = dates[dates.length - 1]
  const spanDays = Math.max(1, (new Date(t1) - new Date(t0)) / 86400000)
  const x = (d) => padL + ((new Date(d) - new Date(t0)) / 86400000) / spanDays * (W - padL - padR)
  const y = (v) => padT + (1 - (v - min) / span) * (H - padT - padB)

  const gridLines = [0, .25, .5, .75, 1].map((f) => {
    const yy = padT + f * (H - padT - padB)
    const val = max - f * span
    return `<line class="axis" x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}"/>
            <text class="lbl" x="${padL - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${val.toFixed(0)}</text>`
  }).join('')

  const paths = series.map((s) => {
    const pts = s.points.filter((p) => Number.isFinite(p.v)).map((p) => ({ x: x(p.d), y: y(p.v), d: p.d, v: p.v }))
    if (!pts.length) return ''
    const d = monotonePath(pts)
    const color = s.rust ? ' rust' : ''
    const dots = pts.map((p) => `<g role="button" tabindex="0" data-act="pv-day" data-day="${esc(p.d)}" aria-label="${esc(p.d)} 当天记录 ${p.v}${unit ? ' ' + unit : ''}"><title>${esc(p.d)} · ${p.v}${unit ? ' ' + unit : ''}（点开当天记录）</title><circle class="pt-hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9"/><circle class="pt${color}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.1"/></g>`).join('')
    const last = pts[pts.length - 1]
    return `<path class="line${color}" d="${d}"/>
            ${dots}
            <text class="lastlbl" x="${(last.x + 13).toFixed(1)}" y="${(last.y + 4).toFixed(1)}">${last.v}${unit ? ' ' + unit : ''}</text>`
  }).join('')

  const evtMarks = showEvents
    ? events.map((e) => `<g role="button" tabindex="0" data-act="pv-day" data-day="${esc(e.d)}" aria-label="${esc(e.d)} ${esc(e.label)}"><rect class="evt-hit" x="${(x(e.d) - 6).toFixed(1)}" y="${H - padB}" width="12" height="13" fill="transparent"/><rect class="evt" x="${(x(e.d) - 1.4).toFixed(1)}" y="${H - padB + 3}" width="2.8" height="7" rx="1"/></g>`).join('')
    : ''

  const xLabels = [t0, t1].map((d, i) =>
    `<text class="lbl" x="${i ? W - padR : padL}" y="${H - 4}" text-anchor="${i ? 'end' : 'start'}">${d.slice(5)}</text>`).join('')

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="数值趋势图，共 ${all.length} 个数据点">
    ${gridLines}${paths}${evtMarks}${xLabels}
  </svg>`
}

/* ---------------- 卡片组件 ---------------- */
function card({ title, sub, body, actions = '', cls = '' }) {
  return `<section class="card ${cls}">
    <div class="card-head">
      <div class="title"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
      ${actions ? `<div class="card-actions">${actions}</div>` : ''}
    </div>
    ${body}
  </section>`
}
const moreMenu = (page, extra = '') => `<button class="more" data-act="more" data-page="${page}" aria-haspopup="dialog">⋯ 更多</button>${extra}`

function table(cols, rows, emptyText = '还没有记录。', rowAct = null) {
  if (!rows || !rows.length) return `<div class="empty">${esc(emptyText)}</div>`
  return `<div class="table-wrap"><table>
    <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr${rowAct ? ` role="button" tabindex="0" data-act="${esc(rowAct.act)}" data-day="${esc(r[rowAct.col])}" aria-label="${esc(r[0])} 详情"` : ''}>${r.map((c, i) => `<td class="${i === 0 ? 'num-cell' : ''}">${c === null || c === undefined ? '<span class="tag">null</span>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`
}

/* One catalog owns category order, names and identities on both pages. No clinical ranking. */
const metricCatalog = [
  { id: 'hb', name: '输血前血红蛋白', short: 'Hb', category: '血常规', unit: 'g/L', color: 'var(--mint-ink)' },
  { id: 'ferritin', name: '血清铁蛋白', short: '铁蛋白', category: '铁负荷', unit: 'ng/mL', color: 'var(--rust)' },
  { id: 'height', name: '身高', short: '身高', category: '身体测量', unit: 'cm', color: '#507baf' },
  { id: 'weight', name: '体重', short: '体重', category: '身体测量', unit: 'kg', color: '#8a688e' },
]
const metricCategories = [...new Set(metricCatalog.map(m => m.category))]
function metricSeries(profile = P()) {
  return metricCatalog.flatMap(def => {
    const raw = def.id === 'weight' ? (profile.growth?.rows || []).map(r => ({ d: r[0], v: r[2] })) : (profile.series?.[def.id] || [])
    const groups = new Map()
    raw.filter(r => !['pending', 'withdrawn', 'superseded'].includes(r.reviewState)).forEach((r, index) => {
      const unit = r.unit === undefined ? def.unit : r.unit
      const method = r.method || '', laboratory = r.laboratory || ''
      const key = JSON.stringify([def.id, unit, method, laboratory])
      if (!groups.has(key)) groups.set(key, { ...def, key, unit, method, laboratory, rows: [] })
      groups.get(key).rows.push({ ...r, index, v: numOrNull(r.v) })
    })
    if (!groups.size) groups.set(def.id, { ...def, key: def.id, method: '', laboratory: '', rows: [] })
    return [...groups.values()].map(g => {
      g.rows.sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || a.index - b.index)
      g.points = g.rows.filter(r => Number.isFinite(r.v) && /^\d{4}-\d{2}-\d{2}$/.test(r.d || '') && Number.isFinite(Date.parse(r.d)))
      // 可比组身份 key 已含 单位 / 方法 / 机构，组内这些字段天然一致；
      // 因此「方法 / 机构为空」不该把整条线吞掉（演示数据与手工补录都留空）。
      // 只保留两条硬条件：有单位（否则数值无意义）+ 同一天只有一条（同日多条顺序不明，不假定前次）。
      g.connectable = !!g.unit && new Set(g.points.map(r => r.d)).size === g.points.length
      return g
    })
  })
}
function selectedMetricSeries() {
  const all = metricSeries()
  if (!state.metricSelections) state.metricSelections = {}
  if (!state.metricSelections[state.profile]) state.metricSelections[state.profile] = all.filter(g => ['hb', 'ferritin'].includes(g.id)).slice(0, 4).map(g => g.key)
  return all.filter(g => state.metricSelections[state.profile].includes(g.key))
}
function metricPlot(groups, mini = false) {
  const points = groups.flatMap(g => g.points)
  if (!points.length) return '<div class="empty">没有所选指标的有效日期数值；可扩大资料范围或选择指标。</div>'
  const dates = points.map(r => Date.parse(r.d)), start = Math.min(...dates), span = Math.max(86400000, Math.max(...dates) - start)
  const W = 640, H = mini ? 122 : 230
  // 大图右侧留 96px 给末点数值标签（标签压在曲线上就读不清了）；卡片背面迷你图无标签，画满即可。
  const plotRight = mini ? 608 : 544
  const x = d => 28 + (Date.parse(d) - start) / span * (plotRight - 28)
  const series = groups.map(g => {
    const vals = g.points.map(r => r.v)
    if (!vals.length) return null
    const lo = Math.min(...vals), hi = Math.max(...vals), range = hi - lo || Math.max(Math.abs(hi) * .08, 1)
    const y = v => 16 + (1 - (v - lo) / range) * (H - 45)
    return { g, pts: g.points.map(r => ({ x: x(r.d), y: y(r.v), v: r.v })) }
  }).filter(Boolean)
  const body = series.map(({ g, pts }) => `<g data-series="${esc(g.key)}" style="--series-color:${g.color}">${g.connectable && pts.length > 1 ? `<path class="metric-line" pathLength="1" d="${monotonePath(pts)}"/>` : ''}${g.points.map((r, i) => `<g role="button" tabindex="0" data-act="metric-source" data-key="${esc(g.key)}" data-index="${r.index}" aria-label="${esc(g.name)} ${r.v} ${esc(g.unit)} ${esc(r.d)}，查看来源"><title>${esc(g.name)} ${r.v} ${esc(g.unit)} ${esc(r.d)}</title><circle class="point-hit" cx="${pts[i].x}" cy="${pts[i].y}" r="12"/><circle class="metric-dot" cx="${pts[i].x}" cy="${pts[i].y}" r="3.5"/></g>`).join('')}</g>`).join('')
  // 16 号 §R4：只标末点，统一放在右侧留白里（左锚定、不压曲线），多序列按 y 错开 ≥11px。
  const lastLabels = mini ? [] : series.map(({ g, pts }) => {
    const last = pts[pts.length - 1]
    return { x: plotRight + 10, y: last.y + 4, anchor: 'start', text: `${Number(last.v.toFixed(3))}${g.unit ? ' ' + g.unit : ''}`, color: g.color }
  }).sort((a, b) => a.y - b.y)
  lastLabels.forEach((l, i) => {
    const prev = lastLabels[i - 1]
    if (prev && l.y - prev.y < 11) l.y = prev.y + 11
    l.y = Math.max(12, Math.min(H - 16, l.y))
  })
  const labels = lastLabels.map(l => `<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="${l.anchor}" class="metric-last" style="fill:${l.color}">${esc(l.text)}</text>`).join('')
  return `<svg class="metric-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="每条线按自身全部记录范围绘制，不代表不同指标数值可比">${body}${labels}<text x="28" y="${H - 4}" class="metric-axis">${esc(points.reduce((a,r) => r.d < a ? r.d : a, points[0].d))}</text><text x="${plotRight}" y="${H - 4}" text-anchor="end" class="metric-axis">${esc(points.reduce((a,r) => r.d > a ? r.d : a, points[0].d))}</text></svg>`
}
function metricCard(g) {
  const key = state.profile + ':' + g.key, flipped = !!state.flipped[key]
  const latest = g.rows.filter(r => r.d).at(-1), previous = g.points.at(-2)
  const comparable = g.connectable && latest && Number.isFinite(latest.v) && previous && latest.d !== previous.d
  const delta = comparable ? latest.v - previous.v : null
  const comparison = delta !== null ? `${delta > 0 ? '↑ +' : delta < 0 ? '↓ ' : '→ '}${Number(delta.toFixed(3))} ${g.unit}（${previous.d} → ${latest.d}）` : g.rows.length === 1 ? '暂无可比较的前次记录' : '仅显示记录点；可比信息待核'
  return `<div class="metric-card" role="group" tabindex="0" aria-roledescription="可翻转指标卡" aria-label="${esc(g.name)}，${flipped ? '趋势面' : '最近值面'}，Enter 或空格翻面" data-act="metric-flip" data-key="${esc(key)}" data-flipped="${flipped}"><div class="metric-card-inner"><div class="metric-face metric-front" aria-hidden="${flipped}" ${flipped ? 'inert' : ''}><span class="eyebrow">${esc(g.category)}</span><h3>${esc(g.name)}</h3><div class="metric-value">${latest ? esc(Number.isFinite(latest.v) ? latest.v : latest.rawValue || '非数值记录') : '还没有记录'} <small>${esc(g.unit || '单位待核')}</small></div><p>${esc(comparison)}</p><p class="note-line">只回顾记录，不判断变化含义。</p><div class="metric-meta">${g.rows.length} 次记录 · ${esc(latest?.d || '日期待核')}<br>${esc(g.method || '方法待核')} · ${esc(g.laboratory || '机构待核')}<br>${latest ? `<button class="text-link" data-act="metric-source" data-key="${esc(g.key)}" data-index="${latest.index}">来源${latest.sourceText || latest.documentId ? '详情' : '待补 · 查看记录'}</button>` : '来源待补'} · 点击整卡看趋势</div></div><div class="metric-face metric-back" aria-hidden="${!flipped}" ${!flipped ? 'inert' : ''}><h3>${esc(g.name)} · ${esc(g.unit)}</h3>${metricPlot([g], true)}<p class="note-line">${g.points.length === 1 ? '只有 1 次记录，暂不连线' : !g.connectable ? '缺单位或同日多次：只画点，不连线' : '同一可比组，按真实日期连接'}<br>${esc(g.method || '方法待核')} · ${esc(g.laboratory || '机构待核')} · 点击点看来源</p></div></div></div>`
}
function metricGroups() {
  const all = metricSeries()
  return metricCategories.map(category => `<section class="metric-category" data-category="${category}"><h2>${category} <small>${metricCatalog.filter(m => m.category === category).length} 项 · ${all.filter(g => g.category === category).length} 个可比组</small></h2><div class="metric-grid">${all.filter(g => g.category === category).map(metricCard).join('')}</div></section>`).join('')
}
function metricTimelinePanel() {
  const selected = selectedMetricSeries()
  return `<div class="chart-wrap">${metricPlot(selected)}<div class="chart-legend">${selected.map(g => `<span><i style="background:${g.color}"></i>${esc(g.name)} · 全期 ${g.points.length ? Math.min(...g.points.map(r => r.v)) + '–' + Math.max(...g.points.map(r => r.v)) : '无数据'} ${esc(g.unit)}</span>`).join('')}</div><p class="note-line">每条线按该指标全部记录范围缩放，不代表不同指标数值可比。同一指标换单位 / 方法 / 机构会拆成两条线；单点或同日多条只画点。</p></div>`
}
function metricPicker() {
  const selected = selectedMetricSeries().map(g => g.key), all = metricSeries()
  state.metricDraft = [...selected]
  dialog({ title: '选择一图秀指标', eyebrow: '最多 4 条可比序列 · 取消不修改', body: `<p id="metric-selection-status" role="status">已选 ${selected.length} / 4</p><div class="metric-options">${metricCategories.map(category => `<fieldset data-category="${category}"><legend>${category} · ${metricCatalog.filter(m => m.category === category).length} 项</legend>${all.filter(g => g.category === category).map(g => `<label title="${esc(g.unit)} / ${esc(g.method || '方法待核')} / ${esc(g.laboratory || '机构待核')}"><input type="checkbox" data-metric-option="${esc(g.key)}" ${selected.includes(g.key) ? 'checked' : ''}> ${esc(g.short)} <small>${esc(g.rows.at(-1)?.v ?? '未记录')} ${esc(g.unit)} · ${esc(g.method || '方法待核')} / ${esc(g.laboratory || '机构待核')}</small></label>`).join('')}</fieldset>`).join('')}</div>`, foot: '<button class="ghost" data-act="close">取消</button><button class="primary" data-act="metric-apply">确认应用</button>' })
}
function metricSource(key, index) {
  const g = metricSeries().find(g => g.key === key), r = g?.rows.find(r => r.index === Number(index))
  if (!r) return
  dialog({ title: g.name + ' · 记录来源', body: `<p>${esc(r.d || '日期待核')} · ${esc(r.rawValue ?? r.v ?? '原文待补')} ${esc(g.unit || '单位待核')}</p><p>方法：${esc(g.method || '待核')}；机构：${esc(g.laboratory || '待核')}</p><p>转录原文：${esc(r.sourceText || '未转录')}</p><p>参考区间原文：${esc(r.referenceRangeText || '未转录')}</p><p>报告引用：${esc(r.documentId || '来源待补；无可打开的原件')}</p><p class="note-line">演示 / 已保存记录；不会据此生成报告链接。</p>`, foot: '<button class="ghost" data-act="close">关闭来源</button>' })
}
function flipMetric(el) {
  const flipped = !state.flipped[el.dataset.key]
  state.flipped[el.dataset.key] = flipped
  el.dataset.flipped = String(flipped)
  el.setAttribute('aria-label', el.getAttribute('aria-label').replace(flipped ? '最近值面' : '趋势面', flipped ? '趋势面' : '最近值面'))
  const front = $('.metric-front', el), back = $('.metric-back', el)
  front.inert = flipped; back.inert = !flipped
  front.setAttribute('aria-hidden', String(flipped)); back.setAttribute('aria-hidden', String(!flipped))
}

function fold(id, { summary, count, body }) {
  const open = state.folds[id] === true
  return `<div class="fold">
    <button class="fold-head" data-act="fold" data-id="${id}" aria-expanded="${open}">
      <span class="caret">${open ? '▾' : '▸'}</span>
      <b>${esc(summary)}</b>
      <span class="cnt">${count}</span>
      <span class="sum">${open ? '' : '收起态只留一行摘要'}</span>
    </button>
    ${open ? `<div class="fold-body">${body}</div>` : ''}
  </div>`
}

/* ---------------- 36 号 §2.6 看板首卡：病程状态卡（四件） ----------------
 * 四件：eyebrow（D+N 状态卡 · 距…）/ 大字天数（由锚点日派生，不手填）/ 现状行 / 出口按钮排。
 * 锚点 = 输血起点（profile.transfusion_start）；没有锚点时整卡「待初始化」并给三步引导。
 */
const dayDiff = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000)

function statusCard(p, t) {
  const primerBtn = '<button class="ghost" data-primer-open aria-label="疾病概要：地中海贫血是什么？">疾病概要：地中海贫血是什么？</button>'
  const anchor = p.profile.transfusion_start
  if (!anchor) {
    return `<section class="card status-card" aria-labelledby="status-card-title">
      <span class="status-eyebrow">状态卡 · 待初始化</span>
      <h2 class="day-num" id="status-card-title">待初始化</h2>
      <p class="status-line">还没有「输血起点」锚点，天数不手填。三步走完，这里开始按天显示。</p>
      <ol class="status-steps">
        <li>先建档：出生日期、确诊日期、基因报告。</li>
        <li>记第一次输血：得到输血起点日期。</li>
        <li>回到看板：天数与下次事项自动出现。</li>
      </ol>
      <div class="status-actions">
        <button class="primary" data-act="goto" data-view="transfusion">去记第一次输血 →</button>
        ${primerBtn}
      </div>
    </section>`
  }
  const dayN = dayDiff(anchor, today()) + 1
  const planned = p.screening.rows
    .filter((r) => r[2] && r[2] !== '—' && r[2] >= today())
    .sort((a, b) => a[2].localeCompare(b[2]))[0]
  const nextDate = t.summary.next_due || (planned ? planned[2] : '')
  const nextItem = t.summary.next_due ? '输血预约' : (planned ? planned[0] : '')
  const nextText = nextDate ? `下次：${nextDate}（${nextItem}）` : '下次：待登记（输血预约与筛查计划都还没有日期）'
  return `<section class="card status-card" aria-labelledby="status-card-title">
    <span class="status-eyebrow">D+${dayN} 状态卡 · ${nextDate ? '距下一次随访' : '距下一次预约（未登记）'}</span>
    <h2 class="day-num" id="status-card-title">第 ${dayN} 天</h2>
    <span class="day-anchor">自 ${esc(anchor)} 起算（输血起点锚点，派生值不落库）</span>
    <p class="status-line"><b>${esc(p.profile.meta)}</b> · 已记录 ${t.summary.count} 次输血 · 上次 ${esc(t.summary.last_date)}</p>
    <p class="status-line status-next">${esc(nextText)}</p>
    <div class="status-actions">
      <button class="primary" data-act="goto" data-view="transfusion">看输血本（周期与间隔）→</button>
      ${primerBtn}
    </div>
  </section>`
}

/* ---------------- 看板 ---------------- */
function vDashboard() {
  const p = P(), t = p.transfusion, i = p.iron
  const lastIron = i.rows[i.rows.length - 1]
  const lastGrowth = p.growth.rows[p.growth.rows.length - 1]
  const openQ = p.questions.rows.filter((r) => r[2] === 'open').length
  const overdue = p.screening.rows.filter((r) => r[2] !== '—' && r[3] === '—')
  const days = t.summary.days_since
  const nextIn = t.summary.next_due ? Math.round((new Date(t.summary.next_due) - new Date(today())) / 86400000) : null

  const stat = (k, label, value, unit, cap, sub) => `<div class="metric">
    <span class="cap">${esc(label)}</span>
    <span class="num">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</span>
    <span class="sub">${esc(cap)}</span>
    ${sub ? `<span class="sub">${sub}</span>` : ''}
  </div>`

  const hbLast = t.rows[t.rows.length - 1]
  return `<div class="page-head"><div><h1>看板</h1><p>今天要做什么、下一次输血是哪天、有没有该问医生的事。</p></div><div class="card-actions">${draftButton('dashboard')}</div></div>
  ${voiceBlock('dashboard')}
  ${statusCard(p, t)}
  <div class="grid">
    ${card({
      title: '距离上次输血',
      sub: '派生值：读取时按记录算，不落库',
      actions: `<button class="primary" data-write="primary" data-act="add-transfusion">记这次输血</button>`,
      body: stat('trans', '上次输血', String(days), '天前',
        `上次 ${t.summary.last_date} · 共 ${t.summary.count} 次`,
        t.summary.next_due ? `下次预约 ${t.summary.next_due}（${nextIn >= 0 ? '还有 ' + nextIn + ' 天' : '已过 ' + Math.abs(nextIn) + ' 天'}）` : '预约未登记'),
    })}
    ${card({
      title: '最近一次输血前血红蛋白',
      sub: '报告数值原文，不判断高低',
      actions: moreMenu('transfusion'),
      body: stat('hb', '输血前 Hb', hbLast ? hbLast[1] : '—', 'g/L', hbLast ? `${hbLast[0]} · ${hbLast[3]}` : '还没有记录', hbLast ? `输血反应：${hbLast[4]}` : ''),
    })}
    ${card({
      title: '铁蛋白最近一次',
      sub: '只显示数值与报告原文',
      actions: moreMenu('iron'),
      body: stat('ft', '血清铁蛋白', lastIron ? lastIron[1] : '—', 'ng/mL', lastIron ? `${lastIron[0]} · ${daysAgo(lastIron[0])} 天前` : '还没有记录', lastIron ? esc(lastIron[3]) : ''),
    })}
    ${card({
      title: '生长发育最近一次',
      sub: '百分位为示例参考表计算，未核对',
      actions: moreMenu('growth'),
      body: stat('ht', '身高', lastGrowth ? lastGrowth[1] : '—', 'cm', lastGrowth ? `${lastGrowth[0]} · 体重 ${lastGrowth[2]} kg` : '还没有记录', lastGrowth ? pctLabel(Number(lastGrowth[1])) : ''),
    })}
  </div>

  <div class="grid two" style="margin-top:14px">
    ${card({
      title: '今天可以做的几件事',
      sub: '这里就是入口：点进去，回来还是这页',
      body: `<div class="entry-grid">
        ${[
          ['transfusion', '输血本', '记一次输血、看间隔'],
          ['iron', '铁负荷与排铁', lastIron ? `铁蛋白 ${lastIron[1]} ng/mL（${daysAgo(lastIron[0])} 天前）` : '还没有记录'],
          ['growth', '生长发育', lastGrowth ? `身高 ${lastGrowth[1]} cm` : '还没有记录'],
          ['screening', '筛查日历', overdue.length ? `${overdue.length} 项未记录结果` : '都记了'],
          ['genetics', '生殖与遗传', '要不要再生一个，先备材料'],
          ['cost', '费用与血源', '本月自费还没算'],
          ['glossary', '术语与误解', '「地贫要补铁」为什么不对'],
          ['nutrition', '营养与日常', '排铁药和吃饭怎么错开'],
          ['mind', '心理与家庭', '默认私密，只你自己能看'],
          ['records', '资料库', `${p.candidates.filter((c) => c.status === 'pending').length} 条候选待核对`],
          ['timeline', '病情一图秀', '输血、铁蛋白、身高放一起看'],
          ['review', '就诊准备', `${openQ} 条问题待问`],
        ].map(([v, label, why]) => `<button class="entry" data-act="goto" data-view="${v}">
          <b>${esc(label)}</b><span>${esc(why)}</span></button>`).join('')}
      </div>
      <p class="note-line">距上次输血 <b>${days}</b> 天；铁蛋白上次记录在 <b>${lastIron ? lastIron[0] : '—'}</b>；心铁 T2* 上次记录在 <b>${p.iron.t2star?.[0]?.date || '未记录'}</b>。</p>`,
    })}
    ${card({
      title: '三张卡可以翻过来看最近几次',
      sub: '整卡 180° 翻转；分类记录不翻不连线',
      body: `<div class="metric-grid">${metricSeries().filter(g => ['hb', 'ferritin', 'height'].includes(g.id)).map(metricCard).join('')}</div>`,
    })}
  </div>

  <div class="grid two" style="margin-top:14px">
    ${card({ title: '最近三次输血（折叠卡）', sub: '收起态一行摘要 + 次数，展开不撑破一屏',
      body: fold('dash-trans', {
        summary: `最近一次 ${t.summary.last_date} · ${hbLast ? hbLast[2] + ' · 反应 ' + (hbLast[4] || '无') : ''}`,
        count: t.summary.count,
        body: table(['日期', '输血前 Hb', '量', '制品', '反应', '地点'], t.rows.slice(-3).reverse()),
      }) })}
    ${card({ title: '资料与候选', sub: 'AI 产出先落候选区，逐项核对才入档',
      body: `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
        ${p.candidates.map((c) => `<li>· <b>${esc(c.field)}</b> = ${esc(c.value)} <span class="tag ${c.status === 'pending' ? 'wait' : 'ok'}">${c.status === 'pending' ? '待核对' : '已入档'}</span> <span class="cap">${esc(c.note)}</span></li>`).join('')}
      </ul>
      <div style="margin-top:8px"><button class="more" data-act="goto" data-view="records" data-sub="1">去核对</button></div>` })}
  </div>`
}

function miniSeries(points, unit) {
  if (!points.length) return '<span class="cap">还没有数据</span>'
  const W = 190, H = 74, pad = 8
  const vals = points.map((p) => p.v)
  let min = Math.min(...vals), max = Math.max(...vals)
  if (min === max) { min -= 1; max += 1 }
  const pts = points.map((p, i) => ({
    x: pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2),
    y: pad + (1 - (p.v - min) / (max - min)) * (H - pad * 2),
  }))
  return `<div><svg class="chart" style="height:74px" viewBox="0 0 ${W} ${H}" role="img" aria-label="最近 ${points.length} 次记录">
    <path class="line" d="${monotonePath(pts)}"/>
    ${pts.map((p) => `<circle class="pt" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4"/>`).join('')}
  </svg><span class="cap">最近 ${points.length} 次 · 末值 ${points[points.length - 1].v} ${unit}</span></div>`
}

/* ---------------- 生长发育百分位（示例参考表，未核对） ---------------- */
/* 仅用于演示计算流程；参考值未取得指南/标准核对，界面必须标"示例参考·未核对"。 */
const REF_TABLE = { male6: { h50: 116.0, hsd: 4.6, w50: 20.5, wsd: 3.1 }, female24: { h50: 158.0, hsd: 5.4, w50: 47.0, wsd: 5.6 } }
function pctLabel(cm) {
  const ref = state.profile === 'A' ? REF_TABLE.male6 : REF_TABLE.female24
  const z = (cm - ref.h50) / ref.hsd
  const pct = Math.round(normalCdf(z) * 100)
  return `身高约第 ${pct} 百分位（示例参考表 · 未核对）`
}
function normalCdf(z) {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
window.__ferropal = { normalCdf, monotonePath, openPageView, closePageView, backPageView, pageViewForDay }

/* ---------------- 输血本 ---------------- */
function vTransfusion(sub) {
  const p = P(), t = p.transfusion
  const hbLast = t.rows[t.rows.length - 1]
  const s = sub ?? 0
  const subs = PAGES.find((x) => x.id === 'transfusion').subs
  const body = [
    () => `${card({ title: '输血记录', sub: '一次输血一行；间隔是派生值，不落库', actions: moreMenu('transfusion'),
      body: table(['日期', '输血前 Hb', '量', '制品', '反应', '地点'], [...t.rows].reverse()) })}
      ${guideNote(['G1-16', 'G1-01', 'G1-02'], `最近一次输血前 Hb <b>${hbLast ? hbLast[1] : '—'} g/L</b>；中位间隔 <b>${t.summary.median_interval ?? '—'} 天</b>（均为你自己记录算出的事实）。`)}`,
    () => `<div class="chart-wrap">
        ${chart({ series: [{ key: 'interval', label: '输血间隔', points: t.summary.intervals.map((v, i) => ({ d: t.rows[i + 1][0], v })) }], unit: '天', showEvents: false })}
        <div class="chart-legend"><span><i style="background:var(--mint-ink)"></i>相邻两次输血的间隔天数</span><span>中位 ${t.summary.median_interval ?? '—'} 天</span></div>
        <p class="note-line">显示带宽是工作台口径，不是医嘱；间隔由记录日期相减得出，记录少时波动大。</p>
      </div>`,
    () => card({ title: '输血反应', sub: '只存护士/家长的原文，不做分级',
      body: table(['日期', '反应原文', '地点'], t.rows.filter((r) => r[4] && r[4] !== '无').map((r) => [r[0], r[4], r[5]]), '没有记录到输血反应。') }),
    () => card({ title: '抗体与配血', sub: '报告原文照抄，不转成"阴性/阳性"判定', actions: moreMenu('antibody'),
      body: table(['日期', '抗体筛查（原文）', '交叉配血（原文）', '备注'], p.antibody.rows.slice().reverse()) }),
  ][s]()
  return `${voiceBlock('transfusion')}${pageHead('transfusion', true)}${body}`
}

/* ---------------- 铁负荷与排铁 ---------------- */
function vIron(sub) {
  const p = P(), s = sub ?? 0
  const plan = p.iron.plan[0]
  const events = p.series.ferritin.map((x) => ({ d: x.d, kind: 'lab', label: '铁蛋白复查' }))
    .concat(p.events.filter((e) => e.kind === 'transfusion').slice(-6))
  const body = [
    () => `${guideNote(['G1-05'], `你记录了 <b>${p.iron.rows.length}</b> 次铁蛋白，最近一次 ${p.iron.rows[p.iron.rows.length - 1][0]}（${p.iron.rows[p.iron.rows.length - 1][1]} ng/mL）；上次记录距今 <b>${daysAgo(p.iron.rows[p.iron.rows.length - 1][0])}</b> 天。`)}
    <div class="chart-wrap">
      ${chart({ series: [{ key: 'ferritin', label: '铁蛋白', points: p.series.ferritin }], events, unit: 'ng/mL' })}
      <div class="chart-legend"><span><i style="background:var(--mint-ink)"></i>血清铁蛋白</span><span><i style="background:var(--rust)"></i>底部短竖线=当天有记录的事件</span></div>
      <p class="note-line">不画任何阈值线：报告自带的参考区间见下表原文；趋势形状不替代医生判断。</p>
    </div>
    ${card({ title: '铁蛋白记录（含报告原文）', sub: '参考区间照抄化验单，缺失就留空', actions: moreMenu('iron'),
      body: table(['日期', '数值', '单位', '报告原文'], p.iron.rows.slice().reverse()) })}`,
    () => `${card({ title: '当前方案', sub: '剂量存医嘱原文，不拆算 mg/kg',
      body: `<div class="metric"><span class="cap">${esc(plan.drug)}</span><span class="num" style="font-size:1.2em">${esc(plan.dose)}</span>
        <span class="sub">起服 ${plan.start} · 途径 ${plan.route === 'oral' ? '口服' : plan.route}</span>
        <span class="sub">换药原因（原文）：${esc(plan.reason)}</span></div>` })}
      ${card({ title: '方案变更（只新增，不覆盖）', sub: '旧方案保留在版本链里', actions: moreMenu('plan'),
        body: table(['起服日', '药名', '剂量（原文）', '换药原因（原文）'], [[plan.start, plan.drug, plan.dose, plan.reason]]) })}`,
    () => card({ title: '心铁 / 肝铁 T2* 报告', sub: '只存数值与报告原文；不标注区间、不判读', actions: moreMenu('t2star'),
      body: table(['日期', '器官', 'T2* / 肝铁', '报告原文'], p.iron.t2star.map((r) => [r.date, r.organ === 'heart' ? '心脏' : '肝脏', r.value === null ? '—' : String(r.value), r.report]), '还没有记录心肝铁报告。') }),
    () => {
      // 依从打卡：最近 28 天，三态（已做/未做/未记）
      const cells = []
      for (let i = 27; i >= 0; i--) {
        const d = new Date(new Date(today() + 'T00:00:00+08:00').getTime() - i * 86400000).toISOString().slice(0, 10)
        cells.push(`<i class="none" title="${d} · 未记录"></i>`)
      }
      return card({ title: '依从打卡（最近 28 天）', sub: '没有打卡事实；全部显示未记录，不推算已做或未做', actions: moreMenu('adherence'),
        body: `<div class="heat">${cells.join('')}</div>
          <div class="heat-legend"><span><i style="display:inline-block;width:9px;height:9px;background:var(--mint-ink);border-radius:2px"></i> 已做</span>
          <span><i style="display:inline-block;width:9px;height:9px;background:#f0d7d8;border-radius:2px"></i> 未做</span>
          <span><i style="display:inline-block;width:9px;height:9px;background:#e8eee7;border-radius:2px"></i> 未记</span></div>
          <p class="note-line">这一页不评价做得好不好，只让你看见"哪几天没记"。 // wording-allow</p>` })
    },
  ][s]()
  return `${voiceBlock('iron')}${pageHead('iron', true)}${body}`
}

/* ---------------- 生长发育 ---------------- */
function vGrowth(sub) {
  const p = P(), s = sub ?? 0
  const last = p.growth.rows[p.growth.rows.length - 1]
  const body = [
    () => `<div class="chart-wrap">
      ${chart({ series: [{ key: 'height', label: '身高', points: p.series.height }], unit: 'cm', showEvents: false })}
      <div class="chart-legend"><span><i style="background:var(--mint-ink)"></i>身高（cm）</span><span>${last ? pctLabel(Number(last[1])) : ''}</span></div>
      <p class="note-line">百分位用内置示例参考表计算，<b>参考值未经指南/标准核对</b>；页面只显示位置，不判断"矮不矮"。</p>
      </div>
      ${card({ title: '身高体重记录', sub: '数字键盘录入；缺生日时不给百分位', actions: moreMenu('growth'),
        body: table(['日期', '身高', '体重', '备注'], p.growth.rows.slice().reverse()) })}`,
    () => card({ title: '青春期与性腺', sub: '按年龄给"该问什么"，不给"该不该查"', actions: moreMenu('puberty'),
      body: `${table(['项目', '状态', '出处'], [
        ['青春期启动评估', p.screening.rows.find((r) => r[0].includes('性腺'))?.[5] || '—', '医生原话'],
        ['月经/遗精记录', '未记录', '—'],
        ['性激素检查', '未记录', '—'],
      ])}
      <p class="note-line">医生当时说的原文优先；没有原文就留空，不推断。</p>` }),
    () => card({ title: '骨与牙齿', sub: '长期输血与去铁相关的随访项', actions: moreMenu('bone'),
      body: table(['项目', '上次记录', '结果原文'], [
        ['骨密度（双能 X 线）', p.screening.rows.find((r) => r[0].includes('骨密度'))?.[3] || '—', p.screening.rows.find((r) => r[0].includes('骨密度'))?.[4] || '—'],
        ['牙齿/颌面检查', '—', '—'],
        ['维生素 D', '—', '—'],
      ]) }),
  ][s]()
  return `${voiceBlock('growth')}${pageHead('growth', true)}${body}`
}

/* ---------------- 筛查日历 ---------------- */
function vScreening(sub) {
  const p = P(), s = sub ?? 0
  const cat = ['annual', 'endocrine', 'cardiac', 'infection'][s] || 'annual'
  const rows = p.screening.rows.filter((r) => r[1] === cat)
  const label = { annual: '年度清单', endocrine: '内分泌筛查', cardiac: '心功能与铁负荷影像', infection: '感染与疫苗' }[cat]
  const cad = p.cadence || null
  const cadenceCard = cad ? card({
    title: '参考节点（不是预约，不是"该查了"）',
    sub: '起点来自确诊/首次输血/生日；只显示你记录过的事实与规则推算的节点',
    body: `<div class="table-wrap"><table><thead><tr><th>检查项</th><th>起点</th><th>最近节点</th><th>上次记录</th><th>说明</th></tr></thead><tbody>
      ${cad.checks.map((c) => `<tr>
        <td>${esc(c.label)}</td>
        <td>${esc(c.start_date || c.start_note || '起点未知')}</td>
        <td>${c.dates && c.dates.length ? esc(c.dates.slice(-2).join(' / ')) : '—'}</td>
        <td>${esc(c.last_date || '未记录')}${c.days_since !== null && c.days_since !== undefined ? `（${c.days_since} 天前）` : ''}</td>
        <td>${esc(c.interval_months ? `${c.interval_months} 个月间隔 · ${c.ref || '出处未取得'}` : `无固定间隔（未取得指南数字）${c.note ? ' · ' + c.note.replaceAll('**', '') : ''}`)}</td>
      </tr>`).join('')}
    </tbody></table></div>
    <p class="note-line">${esc(cad.band_note)} ${esc(cad.reference_note)}</p>`,
  }) : card({ title: '参考节点', sub: '节奏数据未加载', body: '<div class="empty">没有拿到节奏数据；这不代表不需要复查。</div>' })
  return `${voiceBlock('screening')}${pageHead('screening', true)}
  ${cadenceCard}
  ${guideNote(['G1-23', 'G1-11', 'G1-14'], `本档案已记录筛查项 <b>${p.screening.rows.length}</b> 项，其中已有结果 <b>${p.screening.rows.filter((r) => r[3] !== '—').length}</b> 项；甲状腺最近一次 ${p.screening.rows.find((r) => r[0].includes('甲状腺'))?.[3] || '未记录'}。`)}
  ${card({ title: label, sub: '三态：已做 / 未做 / 未出报告；日期只来自医嘱原文', actions: moreMenu('screening'),
    body: table(['项目', '计划日（医嘱原文）', '完成日', '结果原文', '出处'], rows.map((r) => [r[0], r[2], r[3], r[4], r[5]])) })}
  ${card({ title: '全部筛查项', sub: '按年龄与医嘱排，不按工作台推算', body: table(['项目', '类别', '计划日', '完成日'], p.screening.rows.map((r) => [r[0], { annual: '年度', endocrine: '内分泌', cardiac: '心/铁', infection: '感染' }[r[1]], r[2], r[3]])) })}`
}

/* ---------------- 生殖与遗传 ---------------- */
function vGenetics(sub) {
  const p = P(), s = sub ?? 0
  const body = [
    () => `${card({ title: '家系与基因型', sub: '基因型照抄报告原文，不解析、不推断遗传方式',
      body: `<div class="term"><b>患儿基因型</b><span>${esc(p.profile.genotype)}</span></div>
        <div class="term"><b>母亲基因型</b><span>未查（报告里没有这一项）</span></div>
        <div class="term"><b>父亲基因型</b><span>未查</span></div>
        <div class="term"><b>兄弟姐妹</b><span>无</span></div>
        <p class="note-line">空着就写"未查"，不推测携带情况。</p>` })}`,
    () => `${card({ title: '同型配偶风险', sub: '不解释风险比例——那需要医生结合双方基因型',
      body: `<p>工作台不计算、不解释"风险百分之几"。这里只放四个可以直接问医生的问题：</p>
        <ol style="margin-top:6px">
          <li>我和伴侣需要各查哪几项基因？</li>
          <li>如果双方都是携带者，下一步通常怎么安排？</li>
          <li>产前诊断一般安排在孕几周？</li>
          <li>如果这一胎不携带，还需要再查吗？</li>
        </ol>
        <p class="note-line">以上问题来自场景推导，未经访谈核实；回答请以医生原话记在下面。</p>` })}
      ${card({ title: '医生原话记录', sub: '只存原文', actions: moreMenu('genetics'), body: `<div class="empty">还没有记录医生对这几个问题的回答。</div>` })}`,
    () => `${guideNote(['G1-22'], '你记录的医生原话：<b>未记录</b>（等你把门诊里听到的时点写进来，这一栏才有内容）。')}
      ${card({ title: '产前诊断时点（医生原文）', sub: '只记医生说的周数，不给推荐时点',
        body: table(['事项', '医生说的原文', '记录日'], [['产前诊断时间窗', '未记录', '—'], ['需要提前预约的检查', '未记录', '—']]) })}`,
    () => card({ title: '再生计划问题清单', sub: '可直接带进门诊', actions: `<button class="more" data-act="add-question">加一条问题</button>`,
      body: table(['问题', '来源页', '状态'], p.questions.rows.filter((q) => ['genetics', 'review'].includes(q[1]) || q[0].includes('再生') || q[0].includes('生')).map((q) => [q[0], q[1], q[2] === 'open' ? '待问' : q[2]]), '还没有问题。点右上角加一条。') }),
  ][s]()
  return `${voiceBlock('genetics')}${pageHead('genetics', true)}${body}`
}

/* ---------------- 费用与血源 ---------------- */
function vCost(sub) {
  const p = P(), s = sub ?? 0
  const monthly = p.cost.monthly
  const months = Object.keys(monthly).sort()
  const body = [
    () => `${card({ title: '输血费用', sub: '按月分项聚合，不跨类混算', actions: moreMenu('cost'),
      body: table(['月份', '输血（元）', '排铁（元）', '其他（元）'], months.map((m) => [m, (monthly[m].transfusion / 100).toFixed(2), (monthly[m].chelation / 100).toFixed(2), (monthly[m].other / 100).toFixed(2)])) })}`,
    () => `${card({ title: '去铁费用', sub: '自费与医保分开记，才谈得上安排',
      body: table(['日期', '类别', '金额（元）', '医保标记', '备注'], p.cost.rows.filter((r) => r[1] === 'chelation').map((r) => [r[0], '排铁', r[2], r[3] === 'insured' ? '医保' : '自费', r[4]]), '还没有排铁费用记录。') })}`,
    () => `${card({ title: '医保与救助', sub: '只登记你实际办过的事，不承诺任何政策口径',
      body: table(['事项', '状态', '备注'], [['门诊特殊病种备案', '已办', '2024 年起'], ['大病保险', '未办', '—'], ['慈善救助申请', '未办', '—']]) })}`,
    () => `${card({ title: '血源与异地', sub: '血源紧张时最想知道的是"哪里能输"',
      body: table(['事项', '记录', '备注'], [['常用输血点', '市儿童医院 血液科', '预约制'], ['异地就医备案', '未办', '—'], ['互助献血记录', '—', '—']]) })}`,
  ][s]()
  return `${voiceBlock('cost')}${pageHead('cost', true)}${body}`
}

/* ---------------- 术语与误解 ---------------- */
function vGlossary(sub) {
  const s = sub ?? 0
  const body = [
    () => card({ title: '核心词表', sub: '只解释词义与"报告上在哪一栏"，不给判断',
      body: `<div class="term"><b>输血依赖（TDT）</b><span>指需要按固定间隔输红细胞来维持血红蛋白的人。间隔由医生根据你的情况定。</span></div>
        <div class="term"><b>铁过载</b><span>长期输血会带来额外的铁，身体没有主动排出铁的通道，铁会逐渐沉积在心脏、肝脏等器官。</span></div>
        <div class="term"><b>去铁（排铁）治疗</b><span>用药物帮助身体排出多余的铁。常见有口服药与皮下泵两种方式，具体用哪种由医生决定。</span></div>
        <div class="term"><b>血清铁蛋白</b><span>化验单上反映体内储存铁的一个指标，单次数值会受炎症等影响。本页不判断高低。</span></div>
        <div class="term"><b>T2* MRI</b><span>一种磁共振检查，用来估计心脏或肝脏里的铁沉积程度；数值与判读由放射科和医生给出。</span></div>
        <p class="note-line">词义说明为一般性解释，<b>来源与版本未核实</b>；不含任何处置建议。</p>` }),
    () => `${card({ title: '常见误解', sub: '正面处理患者级误解——这一页的存在本身就是一条红线',
      body: `<div class="myth"><div class="no">✗ 「地贫是贫血，要补铁」</div>
          <div>地贫的贫血来自血红蛋白合成问题，而长期输血的人体内铁是<b>偏多</b>的；补铁属于需要医生判断的事，工作台不会给这类建议。</div></div>
        <div class="myth"><div class="no">✗ 「铁蛋白降下来就可以停排铁药」</div>
          <div>要不要调整、要不要停，是医生根据多项检查决定的；工作台只记录你吃了什么、什么时候复查。</div></div>
        <div class="myth"><div class="no">✗ 「输血越多越好，血红蛋白越高越好」</div>
          <div>输血的目标区间由医生设定；输得多也意味着铁负担更重。工作台只记录输血前数值与输注量。</div></div>
        <p class="note-line">每条误解旁边不给"正确做法"，只说明为什么这句话不成立。</p>` })}`,
    () => card({ title: '报告怎么读', sub: '按"先看哪一栏"排序，不解释结论',
      body: table(['报告', '先看', '再记什么'], [
        ['血常规', '血红蛋白（Hb）', '数值 + 采血日期 + 是否输血前'],
        ['铁蛋白', '血清铁蛋白', '数值 + 单位 + 报告自带参考区间'],
        ['T2* MRI', '心/肝 T2* 数值', '数值 + 报告原文（判读以原文为准）'],
        ['配血单', '抗体筛查与交叉配血', '原文照抄，不转"阴性/阳性"'],
      ]) }),
  ][s]()
  return `${voiceBlock('glossary')}${pageHead('glossary', true)}${body}`
}

/* ---------------- 营养与日常 ---------------- */
function vNutrition(sub) {
  const s = sub ?? 0
  const body = [
    () => `${card({ title: '吃什么与不吃什么', sub: '只给"要问医生"的清单，不给食谱',
      body: table(['情况', '要问的问题', '为什么值得问'], [
        ['正在排铁', '这种排铁药和吃饭要不要错开？', '不同药的服法与进食关系不同，说明书与医嘱为准'],
        ['同时"补血"', '家里炖的补血汤能不能喝？', '"补血"食物常含铁，而输血依赖者铁偏多'],
        ['维生素 C', '能不能额外补维 C？', '维 C 影响铁吸收，需按医生意见'],
        ['喝茶/咖啡', '孩子能不能喝？', '与铁吸收有关，具体听医生'],
      ]) })}
      ${card({ title: '本人记录', sub: '记录你实际的做法与医生原话', actions: moreMenu('nutrition'),
        body: `<div class="empty">还没有记录。可以记"医生说要错开两小时"这类原话。</div>` })}`,
    () => `${card({ title: '铁过载饮食误区', sub: '这一页专门对付"贫血就要补"的直觉',
      body: `<div class="myth"><div class="no">✗ 「多吃猪肝补血」</div><div>动物肝脏含铁高；输血依赖者体内铁本就偏多，是否适合要问医生。</div></div>
        <div class="myth"><div class="no">✗ 「红枣红糖补血」</div><div>这类食物不能替代输血，也不改变铁负荷；把它当"治疗"会耽误事。</div></div>
        <p class="note-line">以上为常识性说明，未标注指南出处（本轮未取得指南原件）。</p>` })}`,
    () => `${card({ title: '脾切除后注意', sub: '如果你做过脾切除，这几条值得记下来',
      body: table(['事项', '当前状态', '备注'], [['脾切除', '未做', '—'], ['肺炎球菌疫苗', '—', '—'], ['发热就医提示卡', '—', '—']]) })}
      ${card({ title: '疫苗记录', sub: '只记接种日期与疫苗名', body: `<div class="empty">还没有疫苗记录。</div>` })}`,
  ][s]()
  return `${voiceBlock('nutrition')}${pageHead('nutrition', true)}${body}`
}

/* ---------------- 心理与家庭（默认私密） ---------------- */
function vMind(sub) {
  const s = sub ?? 0
  const open = state.privateOpen
  const locked = !open
  const body = [
    () => card({ title: '孩子的心情', sub: '默认私密：不进 AI 上下文草稿，不参与导出',
      body: `${locked ? privateGate() : `<div class="term"><b>2026-09-14</b><span>放学回来说"同学问我为什么老请假"，说完就不说话了。</span></div>
        <div class="term"><b>2026-08-30</b><span>输血那天很配合，但要求带自己的毯子。</span></div>`}` }),
    () => card({ title: '家长的自责与疲惫', sub: '默认私密',
      body: `${locked ? privateGate() : `<div class="term"><b>2026-09-02</b><span>凌晨三点打完泵，坐着发了会儿呆。不是怪谁，就是累。</span></div>`}` }),
    () => card({ title: '学校与同伴', sub: '默认私密',
      body: `${locked ? privateGate() : `<div class="term"><b>2026-09-20</b><span>跟班主任说了输血日要请假，老师说"知道了"，没再多问。</span></div>`}` }),
    () => card({ title: '兄弟姐妹', sub: '默认私密',
      body: `${locked ? privateGate() : `<div class="term"><b>—</b><span>暂无记录。</span></div>`}` }),
  ][s]()
  return `${voiceBlock('mind')}${pageHead('mind', true)}${body}`
}
const privateGate = () => `<div class="empty">
  <span class="tag priv">私密</span>
  <p style="margin-top:8px">这四页默认不展开。点下面按钮才显示，且不计入导出与 AI 上下文。</p>
  <button class="ghost" data-act="unlock-private" style="margin-top:8px">本次显示（仅当页）</button>
</div>`

/* ---------------- 资料库 ---------------- */
function vRecords(sub) {
  const p = P(), s = sub ?? 0
  const body = [
    () => card({ title: '资料库', sub: '原始文件只登记，不在导入时改写内容', actions: moreMenu('docs'),
      body: table(['文件名', '类型', '日期'], p.docs.map((d) => [d.filename, d.kind, d.date])) }),
    () => card({ title: '整理草稿 / 核对', sub: 'AI 产出落候选区；拒收零副作用', actions: `<button class="more" data-act="goto" data-view="records" data-sub="0">看原文</button>`,
      body: table(['字段', '候选值', '状态', '来源'], p.candidates.map((c) => [c.field, c.value, c.status === 'pending' ? '待核对' : '已入档', c.note])) }),
    () => card({ title: '病情档案', sub: '字段 ≤6；关系决定"本人/代记"徽章',
      body: table(['字段', '值'], [
        ['姓名', p.profile.name], ['关系', p.profile.relation === 'caregiver' ? '家长代记' : '本人'],
        ['出生日期', p.profile.birth_date], ['确诊日', p.profile.dx_date],
        ['首次输血', p.profile.transfusion_start], ['基因型（原文）', p.profile.genotype],
      ]) }),
    () => `<p class="note-line">按同一目录分类；单位、方法、机构变化拆组。分类记录不进入数值趋势。</p>${metricGroups()}`,
    () => card({ title: '病情汇总', sub: '一页看完，可导出', actions: `<button class="primary" data-act="export">导出复诊材料</button>`,
      body: `<ul style="list-style:none;padding:0;margin:0">
        <li>· 档案：${esc(p.profile.meta)}</li>
        <li>· 输血 ${p.transfusion.summary.count} 次，最近 ${p.transfusion.summary.last_date}，中位间隔 ${p.transfusion.summary.median_interval ?? '—'} 天</li>
        <li>· 铁蛋白 ${p.iron.rows.length} 次，最近 ${p.iron.rows[p.iron.rows.length - 1][0]}（${p.iron.rows[p.iron.rows.length - 1][1]} ng/mL）</li>
        <li>· 心铁 T2* 最近 ${p.iron.t2star?.[0]?.date || '未记录'}</li>
        <li>· 待问问题 ${p.questions.rows.filter((q) => q[2] === 'open').length} 条</li>
      </ul>` }),
  ][s]()
  return `${voiceBlock('records')}${pageHead('records', true)}${body}`
}

/* ---------------- 病情一图秀 ---------------- */
function vTimeline(sub) {
  const p = P(), s = sub ?? 0
  const body = [
    () => `<div class="toggle-row"><button class="ghost" data-act="metric-picker" aria-haspopup="dialog">选择指标（最多 4 条）</button></div><div id="metric-timeline-panel">${metricTimelinePanel()}</div>`,
    () => card({ title: '分类与事件', sub: '分类序列只画节点，不连线',
      body: `${table(['日期', '类型', '标签'], p.events.filter((e) => e.kind !== 'lab').map((e) => [e.d, e.kind === 'transfusion' ? '输血' : '里程碑', e.label]))}
        <p class="note-line">分类事件在数值图里只以底部竖线标注，不参与曲线插值。</p>` }),
    () => card({ title: '数据口径', sub: '写给未来的自己看',
      body: `<ul><li>窗口：${DATA.window_months} 个月，数据截止 ${DATA.data_end}</li>
        <li>抽样：输血按真实记录（每 18–21 天），铁蛋白按复查记录，未做任何加密或插值</li>
        <li>分类：里程碑与输血事件不进入数值曲线</li>
        <li>缺失：显式 null，不画成 0</li>
        <li>单位：Hb g/L；铁蛋白 ng/mL；身高 cm；金额元</li></ul>` }),
  ][s]()
  return `${voiceBlock('timeline')}${pageHead('timeline', true)}${body}`
}

/* ---------------- 就诊准备 ---------------- */
function vReview(sub) {
  const p = P(), s = sub ?? 0
  const body = [
    () => card({ title: '复诊节奏', sub: '节点来自医嘱原文与记录，不由工作台推算"该查了"',
      body: table(['事项', '上次', '下次（医嘱原文）', '出处'], p.screening.rows.map((r) => [r[0], r[3], r[2], r[5]])) }),
    () => card({ title: '就诊问题清单', sub: '从各页汇总，每条带来源页', actions: `<button class="more" data-act="add-question">加一条</button>`,
      body: table(['问题', '来源页', '状态'], p.questions.rows.map((q) => [q[0], PAGES.find((x) => x.id === q[1])?.label || q[1], q[2] === 'open' ? '待问' : q[2]])) }),
    () => card({ title: '已保留结果', sub: '导出过的清单留档，不随后续编辑改写',
      body: state.saved.length ? table(['标题', '时间', '备注'], state.saved.map((x) => [x.title, x.t, x.note])) : `<div class="empty">还没有导出记录。</div>` }),
    () => card({ title: '报告与任务', sub: '临床试验检索：本轮未查过（工具未安装）',
      body: `<div class="empty">临床研究线索：<b>未查过</b>。本机未安装统一检索工具，不显示任何编造条目。</div>
        <div style="margin-top:8px">${table(['任务', '状态'], [['下次复诊带材料', '待办'], ['补录心铁报告', '待办']])}</div>` }),
  ][s]()
  return `${voiceBlock('review')}${pageHead('review', true)}${body}`
}

/* ---------------- 页面头（二级页签） ---------------- */
function pageHead(viewId, withSubs) {
  const page = PAGES.find((p) => p.id === viewId)
  const cur = state.sub[viewId] || 0
  return `<div class="page-head">
    <div><h1>${esc(page.label)}</h1><p>${esc(page.subtitle)}</p></div>
    <div class="card-actions">${draftButton(viewId)}</div>
  </div>
  ${withSubs && page.subs.length ? `<div class="subnav" role="tablist" aria-label="${esc(page.label)}子页">
    ${page.subs.map((s, i) => `<button role="tab" data-act="sub" data-view="${viewId}" data-sub="${i}" aria-selected="${cur === i}">${esc(s)}</button>`).join('')}
  </div>` : ''}`
}

/* ---------------- AI 草稿：携带本页上下文，仅填草稿不发送 ---------------- */
/** 每页一句话上下文：只放已记录的事实；私密页不放内容。 */
const DRAFT_CONTEXT = {
  dashboard: () => `档案：${P().profile.meta}；输血 ${P().transfusion.summary.count} 次，最近 ${P().transfusion.summary.last_date}；铁蛋白最近 ${P().iron.rows.at(-1)?.[0] || '无记录'}。`,
  transfusion: () => `输血记录 ${P().transfusion.rows.length} 条，中位间隔 ${P().transfusion.summary.median_interval ?? '未够两次'} 天；抗体记录 ${P().antibody.rows.length} 条。`,
  iron: () => `铁蛋白记录 ${P().iron.rows.length} 条，最近 ${P().iron.rows.at(-1)?.[0] || '无'}；心肝铁报告 ${P().iron.t2star.length} 份。`,
  growth: () => `身高记录 ${P().growth.rows.length} 条，最近 ${P().growth.rows.at(-1)?.[1] || '无'} cm；体重 ${P().growth.rows.at(-1)?.[2] || '无'} kg。`,
  screening: () => `筛查项 ${P().screening.rows.length} 项，其中有结果 ${P().screening.rows.filter((r) => r[3] !== '—').length} 项。`,
  genetics: () => `基因型原文：${P().profile.genotype}；就诊问题 ${P().questions.rows.length} 条。`,
  cost: () => `费用记录 ${P().cost.rows.length} 条。`,
  glossary: () => '我想弄明白一个术语的含义，不想得到处置建议。',
  nutrition: () => '我想把饮食和用药的注意点问清楚，不需要食谱推荐。',
  mind: () => '（私密页：不把本页内容带进 AI 草稿）',
  records: () => `资料 ${P().docs.length} 份，待核对候选 ${P().candidates.filter((c) => c.status === 'pending').length} 条。`,
  timeline: () => `可选指标：${(typeof metricCatalog !== 'undefined' ? metricCatalog.map((m) => m.short).join('、') : '见指标页')}。`,
  review: () => `待问问题 ${P().questions.rows.filter((q) => q[2] === 'open').length} 条；就诊准备材料未导出。`,
}
const DRAFT_PROMPT = {
  dashboard: '帮我把这几件待办按"下次就诊前要确认的先后"排一下，并指出我还缺哪份材料。',
  transfusion: '帮我把最近几次输血整理成一段话，方便我在门诊说清楚。',
  iron: '帮我把铁蛋白的变化整理成问题清单，我去问医生为什么这样调整。',
  growth: '帮我把身高体重的变化整理成三个可以问医生的问题。',
  screening: '帮我看这份筛查清单里，哪些是"有结果但没说清"，哪些根本没记录。',
  genetics: '帮我把"要不要再生一个"这件事整理成一份就诊问题清单，只列问题。',
  cost: '帮我把这几个月自费的项目按类归一下，我要算清楚一个月大概多少。',
  glossary: '用一个普通人能懂的说法解释这些词，别给我治疗建议。',
  nutrition: '帮我把饮食方面要问医生的问题列出来，不要给食谱。',
  mind: '我想整理一下自己的感受，不带评判地记下来。',
  records: '帮我把待核对的候选逐条列出来，说明每条来自哪份材料。',
  timeline: '帮我看这些指标在时间上有没有一起变化，只描述同不同步，不下结论。',
  review: '帮我把待问的问题按优先级排一下，并提醒我要带哪几份材料。',
}
let draftSeq = 0
function draftButton(view) {
  const prompt = `${DRAFT_CONTEXT[view] ? DRAFT_CONTEXT[view]() : ''}\n${DRAFT_PROMPT[view] || '帮我整理这一页的要点。'}`
  return `<button class="ghost" data-act="agent-draft" data-prompt="${esc(prompt.trim())}" aria-haspopup="dialog">带着这页去问 AI</button>`
}
function fallbackDraft(prompt, reason) {
  /* 页面不自建聊天窗：没有宿主会话时只把草稿复制到剪贴板，并如实说明 */
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(prompt).catch(() => {})
  toast(reason || '没有可写入的会话：草稿已复制，可粘贴到 DSH 原生 AI 对话里')
}
function requestAgentDraft(prompt) {
  const hosted = typeof window.parent !== 'undefined' && window.parent !== window
  if (!hosted) return fallbackDraft(prompt)
  const requestId = 'r' + (++draftSeq) + '-' + Date.now().toString(36)
  let settled = false
  const finish = (ok, message) => {
    if (settled) return
    settled = true
    window.removeEventListener('message', onMessage)
    clearTimeout(timer)
    if (ok) toast(message || '已填进宿主会话输入框——检查后自己按发送')
    else fallbackDraft(prompt, '没能写进会话草稿：' + (message || '未知原因') + '（已复制，可粘贴）')
  }
  const onMessage = (event) => {
    if (event.source !== window.parent) return
    if (event.origin !== location.origin) return
    const data = event.data
    if (!data || data.type !== 'ferropal:agent-draft-result' || data.requestId !== requestId) return
    finish(data.ok === true, data.error)
  }
  window.addEventListener('message', onMessage)
  const timer = setTimeout(() => finish(false, '会话没有回应，可能未连接'), 4000)
  window.parent.postMessage({ type: 'ferropal:agent-draft', requestId, prompt }, location.origin)
}

/* ---------------- 整页视图（32 号）：栈式，返回/关闭/退一层 ---------------- */
function openPageView({ title, body, eyebrow = '详情' }) {
  const stack = state.pageview ? state.pageview.stack : []
  const trigger = document.activeElement
  // 关闭后 #main 会整块重渲染，旧节点会脱离文档；记下"怎么找回它"而不是存节点引用。
  const key = trigger && trigger.dataset
    ? { act: trigger.dataset.act || null, day: trigger.dataset.day || null, view: state.view, sub: state.sub[state.view] || 0 }
    : null
  state.pageview = {
    stack: [...stack, { title, body, eyebrow, scroll: $('#main').scrollTop, focusKey: key }],
  }
  render()
}
/** 重渲染后把焦点还给触发者：先按 data-day/data-act 找同款节点，找不到退回当前页签。 */
function restoreFocus(key) {
  if (!key) return
  let el = null
  if (key.act && key.day) el = $(`#main [data-act="${key.act}"][data-day="${key.day}"]`)
  if (!el && key.act) el = $(`#main [data-act="${key.act}"]`)
  if (!el) el = $(`#nav .nav-btn[data-view="${key.view}"]`)
  if (el && el.focus) el.focus({ preventScroll: true })
}
/** 返回：只退一层（深 3 层不会一按全关）。 */
function backPageView() {
  if (!state.pageview) return
  const stack = state.pageview.stack.slice(0, -1)
  const back = stack[stack.length - 1] || null
  state.pageview = stack.length ? { stack } : null
  render()
  if (back) return
  const pv = state.pageview === null && state.__lastClosed
  if (state.__lastClosed) {
    $('#main').scrollTop = state.__lastClosed.scroll || 0
    restoreFocus(state.__lastClosed.focusKey)
    state.__lastClosed = null
  }
}
/** 关闭：整叠一起关，回到打开前的滚动位置与焦点。 */
function closePageView() {
  const first = state.pageview?.stack?.[0] || null
  state.pageview = null
  state.__lastClosed = first
  render()
  if (first) {
    $('#main').scrollTop = first.scroll || 0
    restoreFocus(first.focusKey)
  }
}
/** 当天记录：整页视图的第一类真实内容。 */
function pageViewForDay(day) {
  const p = P()
  const rowsOf = (list, map) => list.filter((r) => map(r)[0] === day).map(map)
  const parts = []
  const trans = rowsOf(p.transfusion.rows, (r) => [r[0], `输血前 Hb ${r[1]} g/L · ${r[2]} · ${r[3]}`, `反应：${r[4]}`, `地点：${r[5]}`])
  if (trans.length) parts.push(`<h3>输血</h3>${table(['日期', '记录', '反应', '地点'], trans)}`)
  const iron = rowsOf(p.iron.rows, (r) => [r[0], `${r[1]} ${r[2]}`, r[3]])
  if (iron.length) parts.push(`<h3>铁蛋白</h3>${table(['日期', '数值', '报告原文'], iron)}`)
  const growth = rowsOf(p.growth.rows, (r) => [r[0], `身高 ${r[1]} cm`, `体重 ${r[2]} kg`])
  if (growth.length) parts.push(`<h3>身高体重</h3>${table(['日期', '身高', '体重'], growth)}`)
  const q = rowsOf(p.questions.rows, (r) => [r[0], r[1], r[2]]).filter(() => false)
  const body = parts.length
    ? parts.join('')
    : `<div class="empty">这天没有记录。<br>输血、铁蛋白、身高体重都按记录日期归到这里。</div>`
  openPageView({ title: `${day} 当天记录`, eyebrow: '当天记录', body })
  return q
}

/* ---------------- 渲染 ---------------- */
const VIEWS = {
  dashboard: vDashboard, transfusion: vTransfusion, iron: vIron, growth: vGrowth,
  screening: vScreening, genetics: vGenetics, cost: vCost, glossary: vGlossary,
  nutrition: vNutrition, mind: vMind, records: vRecords, timeline: vTimeline, review: vReview,
}

function renderNav() {
  const p = P()
  const counts = { review: p.questions.rows.filter((q) => q[2] === 'open').length, records: p.candidates.filter((c) => c.status === 'pending').length }
  $('#nav').innerHTML = PAGES.map((page) => {
    const c = counts[page.id]
    return `<button class="nav-btn" data-act="nav" data-view="${page.id}" aria-current="${state.view === page.id ? 'page' : 'false'}">${esc(page.label)}${c ? `<span class="nav-count">${c}</span>` : ''}</button>`
  }).join('')
}

function render() {
  const p = P()
  document.body.dataset.font = state.font === 'large' ? 'large' : 'standard'
  $('#profile-name').textContent = p.profile.name
  $('#profile-meta').textContent = p.profile.meta.split('·').slice(0, 2).join('·')
  $('#profile-avatar').textContent = p.profile.name.slice(0, 1)
  $('#app-version').textContent = VERSION
  $('#app-build').textContent = BUILD
  $('#ver-chip').textContent = VERSION
  renderNav()
  const fn = VIEWS[state.view] || vDashboard
  $('#main').innerHTML = fn(state.sub[state.view] || 0)
  $('#main').scrollTop = 0
  // 整页视图
  const old = $('.pageview')
  if (old) old.remove()
  if (state.pageview) {
    const el = document.createElement('section')
    el.className = 'pageview'
    el.setAttribute('role', 'region')
    el.setAttribute('aria-label', state.pageview.title)
    const top = state.pageview.stack[state.pageview.stack.length - 1]
    el.innerHTML = `<div class="pageview-bar">
        <button class="ghost" data-act="pv-back">← 返回</button>
        <div class="grow"><span class="eyebrow">${esc(top.eyebrow)}${state.pageview.stack.length > 1 ? ` · 第 ${state.pageview.stack.length} 层` : ''}</span><h1>${esc(top.title)}</h1></div>
        <button class="icon-btn" data-act="pv-close" aria-label="关闭整页视图">×</button>
      </div>${top.body}`
    document.body.appendChild(el)
  }
}


/* ---------------- 表单 / 弹窗 ---------------- */
function dialog({ title, eyebrow = '小铁宝', body, foot = '' }) {
  $('#dialog-eyebrow').textContent = eyebrow
  $('#dialog-title').textContent = title
  $('#dialog-body').innerHTML = body
  $('#dialog-foot').innerHTML = foot || '<button class="ghost" data-act="close">取消</button>'
  const d = $('#dialog')
  if (!d.open) d.showModal()
}

const field = (label, input, hint = '') => `<div class="field"><label>${esc(label)}</label>${input}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`
const inputText = (id, ph = '') => `<input id="${id}" type="text" placeholder="${esc(ph)}">`
const inputDate = (id, v = '') => `<input id="${id}" type="date" value="${v}">`
const inputNum = (id, ph = '') => `<input id="${id}" inputmode="decimal" type="number" step="any" placeholder="${esc(ph)}">`

function addTransfusionDialog() {
  dialog({
    title: '记一次输血', eyebrow: '手工补一条 · 5 个字段',
    body: field('日期', inputDate('f-date', today())) +
      `<div class="form-row">${field('输血前 Hb（g/L）', inputNum('f-hb', '78'))}${field('输注量（U）', inputNum('f-units', '2'))}</div>` +
      field('血制品（原文）', inputText('f-product', '去白红细胞')) +
      field('输血反应（原文，没有就写"无"）', inputText('f-reaction', '无')) +
      `<p class="hint">工作台不判断这次输血的量够不够，只记录你看到的事实。</p>`,
    foot: '<button class="ghost" data-act="close">取消</button><button class="primary" data-act="save-transfusion">保存</button>',
  })
}

function addFerritinDialog() {
  dialog({
    title: '补一次铁蛋白', eyebrow: '手工补一条 · 4 个字段',
    body: field('日期', inputDate('f-date', today())) +
      `<div class="form-row">${field('血清铁蛋白', inputNum('f-ft', '3820'))}${field('单位', inputText('f-unit', 'ng/mL'))}</div>` +
      field('报告自带参考区间（原文，可空）', inputText('f-ref', '15–500')) +
      `<p class="hint">参考区间缺失就留空；工作台不会替你把空白补成通用区间。</p>`,
    foot: '<button class="ghost" data-act="close">取消</button><button class="primary" data-act="save-ferritin">保存</button>',
  })
}

function addGrowthDialog() {
  dialog({
    title: '量一次身高体重', eyebrow: '手工补一条 · 3 个字段',
    body: field('日期', inputDate('f-date', today())) +
      `<div class="form-row">${field('身高（cm）', inputNum('f-h', '117'))}${field('体重（kg）', inputNum('f-w', '20.8'))}</div>`,
    foot: '<button class="ghost" data-act="close">取消</button><button class="primary" data-act="save-growth">保存</button>',
  })
}

function addQuestionDialog() {
  dialog({
    title: '加一条想问的事', eyebrow: '手工 · 1 个字段',
    body: field('问题', inputText('f-q', '这次铁蛋白比上次高，需要加药吗？')) +
      `<p class="hint">AI 也可以帮你起草，但不会替你发送、也不写建议语气。</p>`,
    foot: '<button class="ghost" data-act="close">取消</button><button class="primary" data-act="save-question">保存</button>',
  })
}

/* ---------------- 档案 / 设置 / 关于 ---------------- */
function profilesDialog() {
  const opts = Object.values(DATA.profiles).map((p) => `<div class="term">
      <b>${esc(p.profile.name)} · ${esc(p.profile.meta)}</b>
      <span>${esc(p.profile.headline)}</span>
      <span style="margin-top:4px"><span class="tag ${p.profile.relation === 'caregiver' ? 'priv' : 'ok'}">${p.profile.relation === 'caregiver' ? '家长代记' : '本人记录'}</span></span>
    </div>`).join('')
  dialog({ title: '切换演示档案', eyebrow: '两个档案·同构', body: opts,
    foot: '<button class="ghost" data-act="close">取消</button><button class="primary" data-act="switch-profile">切换 A / B</button>' })
}

function settingsDialog() {
  dialog({
    title: '设置', eyebrow: '本机优先',
    body: `<div class="term"><b>资料目录</b><span>~/Library/Application Support/ferropal-workbench（原型未接真实目录）</span></div>
      <div class="term"><b>字号</b><span>标准 12.5px / 大字 15px（两档，无第三档）</span></div>
      <div class="term"><b>单位</b><span>Hb g/L · 铁蛋白 ng/mL · 身高 cm · 体重 kg</span></div>
      <div class="term"><b>时区</b><span>Asia/Shanghai（导出时写入）</span></div>
      <div class="term"><b>私密模块</b><span>心理与家庭四页默认收起，不进导出与 AI 上下文</span></div>
      <div class="term"><b>AI 面板</b><span>默认右侧 35%，可拖 25%–45%，可收起重开</span></div>`,
    foot: '<button class="primary" data-act="close">知道了</button>',
  })
}

function aboutDialog() {
  dialog({
    title: '关于小铁宝', eyebrow: 'FerroPal',
    body: `<div class="term"><b>版本</b><span>${VERSION} · 构建 ${BUILD} · 原型（未装机）</span></div>
      <div class="term"><b>这是什么</b><span>给重型地中海贫血家庭用的信息整理工具：记输血、记铁蛋白、记生长、整理复诊材料。</span></div>
      <div class="term"><b>这不是什么</b><span>不诊断、不判断高低、不给用药与治疗建议、不预测预后。</span></div>
      <div class="term"><b>本轮边界</b><span>0 访谈；指南原件未取得（G1/G2/G3 未启用）；临床研究库未查过；MinerU 未实测。</span></div>`,
    foot: '<button class="primary" data-act="close">关闭</button>',
  })
}

function moreDialog(page) {
  const map = {
    transfusion: ['输血记录', ['手工补一条', 'save-transfusion'], ['改这一条', 'edit'], ['看原文', 'raw']],
    iron: ['铁蛋白', ['手工补一条', 'save-ferritin'], ['改这一条', 'edit'], ['看原文', 'raw']],
    plan: ['去铁方案', ['记一次变更', 'edit'], ['看历史版本', 'versions']],
    t2star: ['心肝铁报告', ['手工补一条', 'edit'], ['看原文', 'raw']],
    growth: ['生长发育', ['手工补一条', 'save-growth'], ['改这一条', 'edit']],
    antibody: ['抗体与配血', ['手工补一条', 'edit'], ['看原文', 'raw']],
    cost: ['费用', ['记一笔', 'edit'], ['按月汇总口径', 'raw']],
    screening: ['筛查', ['标记已做', 'edit'], ['改计划日', 'edit']],
    genetics: ['遗传与生育', ['记医生原话', 'edit']],
    nutrition: ['营养', ['记一条做法', 'edit']],
    docs: ['资料库', ['登记一份', 'edit'], ['导入解析（MinerU 未实测）', 'mineru']],
    adherence: ['依从打卡', ['补记昨天', 'edit']],
    puberty: ['青春期', ['记一次', 'edit']],
    bone: ['骨与牙齿', ['记一次', 'edit']],
  }[page] || ['更多', ['手工补一条', 'edit']]
  const [title, ...actions] = map
  dialog({
    title: `${title} · 更多`, eyebrow: '手工通道收敛在「⋯ 更多」里',
    body: `<p class="hint">每页只有一个显式编辑入口；所有手工操作从这里进。</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        ${actions.map(([label, act]) => `<button class="ghost" data-act="${act === 'save-transfusion' ? 'add-transfusion' : act === 'save-ferritin' ? 'add-ferritin' : act === 'save-growth' ? 'add-growth' : 'demo-only'}" style="text-align:left">${esc(label)}</button>`).join('')}
      </div>`,
    foot: '<button class="ghost" data-act="close">关闭</button>',
  })
}

/* ---------------- 导出（产物） ---------------- */
function exportReview() {
  const p = P()
  const lines = []
  lines.push(`# 小铁宝 · 复诊材料（模拟）\n`)
  lines.push(`档案：${p.profile.name} · ${p.profile.meta}\n数据截止：${DATA.data_end} · 生成：${new Date().toISOString()}\n`)
  lines.push(`## 一、输血\n`)
  lines.push(`共 ${p.transfusion.summary.count} 次；最近 ${p.transfusion.summary.last_date}；中位间隔 ${p.transfusion.summary.median_interval ?? '—'} 天。\n`)
  lines.push(`## 二、铁蛋白（报告原文）\n`)
  lines.push(p.iron.rows.map((r) => `- ${r[0]}：${r[1]} ${r[2]}（${r[3]}）`).join('\n') + '\n')
  lines.push(`## 三、想问的事（${p.questions.rows.filter((q) => q[2] === 'open').length} 条）\n`)
  lines.push(p.questions.rows.map((q, i) => `${i + 1}. ${q[0]}\\n   来源：${q[1]}`).join('\n') + '\n')
  lines.push(`\n---\n口径说明：本文件由工作台按记录汇总，不含判断与建议；心理与家庭模块默认不导出。\n`)
  const text = lines.join('\n')
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ferropal-复诊材料-${DATA.data_end}.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  state.saved.push({ title: '复诊材料', t: new Date().toISOString().slice(0, 16).replace('T', ' '), note: `含 ${p.questions.rows.filter((q) => q[2] === 'open').length} 条问题` })
  toast('已生成复诊材料（Markdown），已加入「已保留结果」')
  render()
}

/* 正式页等待落库与读模型刷新；原型没有 adapter，仍走下面的演示分支。 */
async function persistSave(btn, kind, body, message) {
  const adapter = window.FERROPAL_PERSISTENCE
  if (!adapter) return false
  if (btn.disabled) return true
  btn.disabled = true
  const d = $('#dialog')
  const preventCancel = (e) => e.preventDefault()
  d.addEventListener('cancel', preventCancel)
  const controls = [...d.querySelectorAll('input, button')]
  controls.forEach((el) => { el.disabled = true })
  $('#save-error')?.remove()
  try {
    const fresh = await adapter.save(kind, { ...body, profile_id: state.profile })
    DATA = fresh
    window.DEMO_DATA = fresh
    d.close()
    render()
    toast(message)
  } catch (error) {
    const alert = document.createElement('p')
    alert.id = 'save-error'
    alert.setAttribute('role', 'alert')
    alert.textContent = '保存未完成：' + error.message + '。表单已保留；若写入已完成但刷新失败，请先重载核对，避免重复保存。'
    $('#dialog-body').appendChild(alert)
  } finally {
    controls.forEach((el) => { el.disabled = false })
    d.removeEventListener('cancel', preventCancel)
  }
  return true
}

/* ---------------- 事件 ---------------- */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]')
  if (!btn) return
  const act = btn.dataset.act
  const view = btn.dataset.view

  if (act === 'nav') {
    state.view = view
    state.privateOpen = false
    location.hash = view
    render()
    $('#main').focus({ preventScroll: true })
    return
  }
  if (act === 'sub') { state.sub[btn.dataset.view] = Number(btn.dataset.sub); render(); return }
  if (act === 'metric-flip') { flipMetric(btn); return }
  if (act === 'metric-source') { e.stopPropagation(); metricSource(btn.dataset.key, btn.dataset.index); return }
  if (act === 'metric-picker') { metricPicker(); return }
  if (act === 'metric-apply') { state.metricSelections[state.profile] = [...state.metricDraft]; $('#dialog').close(); $('#metric-timeline-panel').innerHTML = metricTimelinePanel(); return }
  if (act === 'fold') { const id = btn.dataset.id; state.folds[id] = !state.folds[id]; render(); return }
  if (act === 'goto') {
    state.view = view
    if (btn.dataset.sub !== undefined) state.sub[view] = Number(btn.dataset.sub)
    location.hash = view
    render()
    return
  }
  if (act === 'profile') { profilesDialog(); return }
  if (act === 'switch-profile') { state.profile = state.profile === 'A' ? 'B' : 'A'; $('#dialog').close(); render(); toast('已切换档案 ' + state.profile); return }
  if (act === 'settings') { settingsDialog(); return }
  if (act === 'about') { aboutDialog(); return }
  if (act === 'close') { $('#dialog').close(); return }
  if (act === 'more') { moreDialog(btn.dataset.page); return }
  if (act === 'add-transfusion') { addTransfusionDialog(); return }
  if (act === 'add-ferritin') { addFerritinDialog(); return }
  if (act === 'add-growth') { addGrowthDialog(); return }
  if (act === 'add-question') { addQuestionDialog(); return }
  if (act === 'export') { exportReview(); return }
  if (act === 'unlock-private') { state.privateOpen = true; render(); return }
  if (act === 'demo-only') { $('#dialog').close(); toast('原型演示：此入口在开发版接真实表单'); return }

  if (act === 'save-transfusion') {
    const p = P()
    const date = $('#f-date').value || today()
    const hb = numOrNull($('#f-hb').value)
    const units = numOrNull($('#f-units').value)
    const product = $('#f-product').value || '未填'
    const reaction = $('#f-reaction').value || '无'
    if (await persistSave(btn, 'transfusion', { date, hb_before: hb, units, product_type: product, reaction_text: reaction }, `已记上 ${date} 这次输血（看板倒计时已更新）`)) return
    p.transfusion.rows.push([date, hb === null ? '—' : String(hb), units === null ? '—' : units + 'U', product, reaction, '手工录入'])
    p.series.hb.push({ d: date, v: hb === null ? null : hb })
    p.events.push({ d: date, kind: 'transfusion', label: `输血 ${units ?? '—'}U` })
    p.events.sort((a, b) => (a.d < b.d ? -1 : 1))
    const last = p.transfusion.rows[p.transfusion.rows.length - 1]
    p.transfusion.summary.count = p.transfusion.rows.length
    p.transfusion.summary.last_date = last[0]
    p.transfusion.summary.days_since = daysAgo(last[0])
    p.transfusion.summary.next_due = null
    $('#dialog').close()
    toast(`已记上 ${date} 这次输血（看板倒计时已更新）`)
    render()
    return
  }
  if (act === 'save-ferritin') {
    const p = P()
    const date = $('#f-date').value || today()
    const v = numOrNull($('#f-ft').value)
    const unit = $('#f-unit').value || 'ng/mL'
    const ref = $('#f-ref').value || ''
    if (await persistSave(btn, 'ferritin', { date, ferritin: v, unit, report_text: `血清铁蛋白 ${v ?? '—'} ${unit}${ref ? `（参考区间 ${ref}）` : '（参考区间未记录）'}` }, '已补录铁蛋白，趋势图多了一个点')) return
    p.iron.rows.push([date, v === null ? '—' : String(v), unit, `血清铁蛋白 ${v ?? '—'} ${unit}${ref ? `（参考区间 ${ref}）` : '（参考区间未记录）'}`])
    if (v !== null) p.series.ferritin.push({ d: date, v })
    p.events.push({ d: date, kind: 'lab', label: '铁蛋白复查' })
    $('#dialog').close()
    toast('已补录铁蛋白，趋势图多了一个点')
    render()
    return
  }
  if (act === 'save-growth') {
    const p = P()
    const date = $('#f-date').value || today()
    const h = numOrNull($('#f-h').value), w = numOrNull($('#f-w').value)
    if (await persistSave(btn, 'growth', { date, height_cm: h, weight_kg: w }, '已记上这次身高体重')) return
    p.growth.rows.push([date, h === null ? '—' : String(h), w === null ? '—' : String(w), '手工录入'])
    if (h !== null) p.series.height.push({ d: date, v: h })
    $('#dialog').close()
    toast('已记上这次身高体重')
    render()
    return
  }
  if (act === 'save-question') {
    const p = P()
    const text = $('#f-q').value.trim()
    if (!text) { toast('写一句问题再保存'); return }
    if (await persistSave(btn, 'question', { text, source_page: state.view }, '已加入就诊问题清单')) return
    p.questions.rows.push([text, state.view, 'open'])
    $('#dialog').close()
    toast('已加入就诊问题清单')
    render()
    return
  }

  // ---- 整页视图 ----
  if (act === 'pv-back') { backPageView(); return }
  if (act === 'pv-close') { closePageView(); return }
  if (act === 'pv-day') { pageViewForDay(btn.dataset.day); return }
  if (act === 'agent-draft') {
    // IP10：预写提示词进草稿，不自动发送；宿主桥失败时明确说"未接通"
    requestAgentDraft(btn.dataset.prompt || '')
    return
  }
})

/* 键盘：Esc 只退一层 */
document.addEventListener('keydown', (e) => {
  if (['Enter', ' '].includes(e.key) && e.target.matches('.metric-card, [data-act="metric-source"], [data-act="pv-day"], tr[role="button"]')) {
    e.preventDefault()
    // SVG 元素没有 click()，统一走事件派发，鼠标与键盘行为一致
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return
  }
  if (e.key === 'Escape') {
    if (state.pageview) { e.preventDefault(); backPageView(); return }
    if ($('#dialog').open) { $('#dialog').close() }
  }
})

/* 档案按钮 → 档案切换 */
$('#profile-btn')?.addEventListener('click', () => profilesDialog())
$('#font-toggle')?.addEventListener('click', () => {
  state.font = state.font === 'large' ? 'std' : 'large'
  $('#font-toggle').setAttribute('aria-pressed', String(state.font === 'large'))
  render()
})

/* hash 深链：#view */
function applyHash() {
  const h = location.hash.replace('#', '')
  if (h && VIEWS[h]) state.view = h
}

applyHash()
render()
console.log(`[FerroPal prototype] ${VERSION} ${BUILD} · 页面 ${PAGES.length} 一级 / ${PAGES.reduce((a, p) => a + p.subs.length, 0)} 二级`)

// Picker edits are transactional: only Confirm publishes this draft.
document.addEventListener('change', e => {
  if (!e.target.matches('[data-metric-option]')) return
  const checked = $$('[data-metric-option]:checked')
  if (checked.length > 4) { e.target.checked = false; $('#metric-selection-status').textContent = '最多选择 4 条；请先取消一条。'; return }
  state.metricDraft = checked.map(input => input.dataset.metricOption)
  $('#metric-selection-status').textContent = `已选 ${checked.length} / 4`
})
