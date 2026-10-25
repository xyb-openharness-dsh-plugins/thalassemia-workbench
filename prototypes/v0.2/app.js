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
const VERSION = 'v0.3.1'
const BUILD = '2026-10-25'

const state = {
  profile: 'A',
  view: 'dashboard',
  sub: {},
  flipped: {},
  folds: {},
  font: 'std',
  agent: { open: false, width: 35, msgs: [], pendingDraft: '' },
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
    const dots = pts.map((p) => `<circle class="pt${color}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.1"/>`).join('')
    const last = pts[pts.length - 1]
    return `<path class="line${color}" d="${d}"/>
            ${dots}
            <text class="lastlbl" x="${(last.x + 13).toFixed(1)}" y="${(last.y + 4).toFixed(1)}">${last.v}${unit ? ' ' + unit : ''}</text>`
  }).join('')

  const evtMarks = showEvents
    ? events.map((e) => `<rect class="evt" x="${(x(e.d) - 1.4).toFixed(1)}" y="${H - padB + 3}" width="2.8" height="7" rx="1"><title>${esc(e.d)} ${esc(e.label)}</title></rect>`).join('')
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

function table(cols, rows, emptyText = '还没有记录。') {
  if (!rows || !rows.length) return `<div class="empty">${esc(emptyText)}</div>`
  return `<div class="table-wrap"><table>
    <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'num-cell' : ''}">${c === null || c === undefined ? '<span class="tag">null</span>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`
}

function flipCard(id, front, back) {
  const flipped = state.flipped[id] === true
  return `<div class="flip ${flipped ? '' : 'is-front'}" data-flipped="${flipped}">
    <div class="flip-inner">
      <div class="flip-face">${front}</div>
      <div class="flip-face flip-back">${back}</div>
    </div>
    <button class="text-link" data-act="flip" data-id="${id}" style="margin-top:6px">${flipped ? '翻回正面' : '看最近几次'}</button>
  </div>`
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
  return `${voiceBlock('dashboard')}
  <div class="grid">
    ${card({
      title: '距离上次输血',
      sub: '派生值：读取时按记录算，不落库',
      actions: `<button class="primary" data-write="primary" data-act="add-transfusion">记这次输血</button>`,
      body: stat('trans', '上次输血', String(days), '天前',
        `上次 ${t.summary.last_date} · 共 ${t.summary.count} 次`,
        t.summary.next_due ? `下次预约 ${t.summary.next_due}（${nextIn >= 0 ? '还有 ' + nextIn + ' 天' : '已过 ' + Math.abs(nextIn) + ' 天'}）` : ''),
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
      body: `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        ${flipCard('f-hb',
          `<div><span class="cap">输血前 Hb</span><div class="num" style="font-size:1.6em;font-weight:700">${hbLast ? hbLast[1] : '—'}<small style="font-size:.45em;color:var(--muted)"> g/L</small></div><span class="cap">${hbLast ? hbLast[0] : ''}</span></div>`,
          miniSeries(p.series.hb, 'g/L'))}
        ${flipCard('f-ft',
          `<div><span class="cap">铁蛋白</span><div class="num" style="font-size:1.6em;font-weight:700">${lastIron ? lastIron[1] : '—'}<small style="font-size:.45em;color:var(--muted)"> ng/mL</small></div><span class="cap">${lastIron ? lastIron[0] : ''}</span></div>`,
          miniSeries(p.series.ferritin, 'ng/mL'))}
        ${flipCard('f-ht',
          `<div><span class="cap">身高</span><div class="num" style="font-size:1.6em;font-weight:700">${lastGrowth ? lastGrowth[1] : '—'}<small style="font-size:.45em;color:var(--muted)"> cm</small></div><span class="cap">${lastGrowth ? lastGrowth[0] : ''}</span></div>`,
          miniSeries(p.series.height, 'cm'))}
      </div>`,
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
window.__ferropal = { normalCdf, monotonePath }

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
        const seed = (Number(d.replace(/-/g, '')) * 2654435761) % 97
        const st = seed < 70 ? 'done' : seed < 82 ? 'miss' : 'none'
        cells.push(`<i class="${st}" title="${d} · ${st === 'done' ? '已做' : st === 'miss' ? '未做' : '未记'}"></i>`)
      }
      return card({ title: '依从打卡（最近 28 天）', sub: '漏记 ≠ 未做；三态必须可区分', actions: moreMenu('adherence'),
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
  return `${voiceBlock('screening')}${pageHead('screening', true)}
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
    () => card({ title: '指标检测', sub: '数值型与分类型分开存；分类不进趋势',
      body: table(['指标', '类型', '记录数'], [
        ['输血前 Hb', 'numeric', String(p.series.hb.length)],
        ['血清铁蛋白', 'numeric', String(p.series.ferritin.length)],
        ['身高', 'numeric', String(p.series.height.length)],
        ['里程碑（确诊/开始输血…）', 'qual', String(p.events.filter((e) => e.kind !== 'transfusion' && e.kind !== 'lab').length || 4)],
      ]) }),
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
  const series = []
  if (state.series.hb) series.push({ key: 'hb', label: '输血前 Hb', points: p.series.hb, rust: false })
  if (state.series.ferritin) series.push({ key: 'ferritin', label: '铁蛋白', points: p.series.ferritin, rust: true })
  if (state.series.height) series.push({ key: 'height', label: '身高', points: p.series.height, rust: false })
  const body = [
    () => `<div class="toggle-row" role="group" aria-label="选择要显示的指标">
        ${[['hb', '输血前 Hb'], ['ferritin', '铁蛋白'], ['height', '身高']].map(([k, l]) =>
          `<button data-act="series" data-key="${k}" aria-pressed="${state.series[k]}">${l}</button>`).join('')}
      </div>
      <div class="chart-wrap">
        ${chart({ series, events: p.events.filter((e) => e.kind === 'transfusion'), unit: '' })}
        <div class="chart-legend">${series.map((x) => `<span><i style="background:${x.rust ? 'var(--rust)' : 'var(--mint-ink)'}"></i>${x.label}</span>`).join('')}
          <span><i style="background:var(--rust);opacity:.6"></i>底部竖线=输血日</span></div>
        <p class="note-line">不同指标量纲不同，同图只用于看"时间上有没有一起动"，不能直接比较大小。</p>
      </div>`,
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
  </div>
  ${withSubs && page.subs.length ? `<div class="subnav" role="tablist" aria-label="${esc(page.label)}子页">
    ${page.subs.map((s, i) => `<button role="tab" data-act="sub" data-view="${viewId}" data-sub="${i}" aria-selected="${cur === i}">${esc(s)}</button>`).join('')}
  </div>` : ''}`
}

/* ---------------- 整页视图（32 号） ---------------- */
function openPageView({ title, body, eyebrow = '详情' }) {
  state.pageview = { title, body, eyebrow, scroll: $('#main').scrollTop, focus: document.activeElement }
  render()
}
function closePageView() {
  const pv = state.pageview
  state.pageview = null
  render()
  if (pv) {
    $('#main').scrollTop = pv.scroll || 0
    if (pv.focus && pv.focus.focus) pv.focus.focus()
  }
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
  // AI 面板
  const dock = $('#agent-dock'), splitter = $('#agent-splitter')
  dock.hidden = !state.agent.open
  splitter.hidden = !state.agent.open
  $('#agent-toggle').setAttribute('aria-expanded', String(state.agent.open))
  $('#agent-dot').className = 'dot ' + (state.agent.open ? 'on' : '')
  $('#agent-label').textContent = state.agent.open ? 'AI 对话（开着）' : 'AI 对话'
  document.body.style.setProperty('--agent-w', state.agent.width + '%')
  renderAgent()
  // 整页视图
  const old = $('.pageview')
  if (old) old.remove()
  if (state.pageview) {
    const el = document.createElement('section')
    el.className = 'pageview'
    el.setAttribute('role', 'region')
    el.setAttribute('aria-label', state.pageview.title)
    el.innerHTML = `<div class="pageview-bar">
        <button class="ghost" data-act="pv-back">← 返回</button>
        <div class="grow"><span class="eyebrow">${esc(state.pageview.eyebrow)}</span><h1>${esc(state.pageview.title)}</h1></div>
        <button class="icon-btn" data-act="pv-close" aria-label="关闭整页视图">×</button>
      </div>${state.pageview.body}`
    document.body.appendChild(el)
  }
}

function renderAgent() {
  const body = $('#agent-body')
  if (!state.agent.msgs.length) {
    body.innerHTML = `<div class="msg ai"><div class="who">小铁宝</div>
      <p>我是这个工作台的助手。你可以说：「昨天输了 2U，输前 78」「铁蛋白这次 3820」——我会把它们整理成<b>待核对</b>的候选，你点头才入档。</p>
      <p style="margin-top:6px;color:var(--muted)">我不会判断高低、不会建议用药。数据都在你本机。</p></div>`
  } else {
    body.innerHTML = state.agent.msgs.map((m, i) => `<div class="msg ${m.role === 'me' ? 'me' : 'ai'}">
      <div class="who">${m.role === 'me' ? '我' : '小铁宝'}</div><p>${esc(m.text)}</p>
      ${m.cand ? `<div class="cand" data-cand="${i}">
        <div class="cand-row"><b>${esc(m.cand.field)}</b><span>${esc(m.cand.value)}</span>
          <span class="tag ${m.cand.status === 'pending' ? 'wait' : m.cand.status === 'accepted' ? 'ok' : 'gap'}">${m.cand.status === 'pending' ? '待核对' : m.cand.status === 'accepted' ? '已入档' : '已拒收'}</span></div>
        ${m.cand.status === 'pending' ? `<div class="cand-actions">
          <button class="primary" data-act="cand-accept" data-idx="${i}">对，入档</button>
          <button class="ghost" data-act="cand-reject" data-idx="${i}">不对，拒收</button></div>` : ''}
        <span class="hint">拒收不产生任何记录（零副作用）。</span>
      </div>` : ''}</div>`).join('')
  }
  const input = $('#agent-input')
  if (input && state.agent.pendingDraft) { input.value = state.agent.pendingDraft; state.agent.pendingDraft = '' }
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
  if (act === 'flip') { const id = btn.dataset.id; state.flipped[id] = !state.flipped[id]; render(); return }
  if (act === 'fold') { const id = btn.dataset.id; state.folds[id] = !state.folds[id]; render(); return }
  if (act === 'series') { const k = btn.dataset.key; state.series[k] = !state.series[k]; render(); return }
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
    const d2 = new Date(last[0] + 'T00:00:00+08:00'); d2.setDate(d2.getDate() + 20)
    p.transfusion.summary.next_due = d2.toISOString().slice(0, 10)
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
  if (act === 'pv-back' || act === 'pv-close') { closePageView(); return }
  if (act === 'agent') {
    state.agent.open = !state.agent.open
    render()
    if (state.agent.open) $('#agent-input')?.focus()
    return
  }
  if (act === 'agent-size') {
    state.agent.width = Number(btn.dataset.size)
    $$('[data-act="agent-size"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.agent.width)))
    $('#agent-splitter').setAttribute('aria-valuenow', String(state.agent.width))
    document.body.style.setProperty('--agent-w', state.agent.width + '%')
    return
  }
  if (act === 'agent-draft') {
    // IP10：预写提示词进输入框，不自动发送
    state.agent.open = true
    state.agent.pendingDraft = btn.dataset.prompt || ''
    render()
    const input = $('#agent-input')
    if (input) { input.value = state.agent.pendingDraft; input.focus() }
    toast('已把提示词放进输入框，你可以改完再发送')
    return
  }
  if (act === 'cand-accept') {
    const i = Number(btn.dataset.idx)
    const m = state.agent.msgs[i]
    m.cand.status = 'accepted'
    P().candidates.push({ field: m.cand.field, value: m.cand.value, status: 'accepted', page: state.view, note: 'AI 候选，用户确认' })
    toast('已入档（候选 → 记录）。可以到「资料库 › 整理草稿」看到它。')
    render()
    return
  }
  if (act === 'cand-reject') {
    const i = Number(btn.dataset.idx)
    const m = state.agent.msgs[i]
    m.cand.status = 'rejected'
    toast('已拒收：这条候选没有写入任何记录。')
    render()
    return
  }
  if (act === 'agent-send') {
    const input = $('#agent-input')
    const text = input.value.trim()
    if (!text) return
    state.agent.msgs.push({ role: 'me', text })
    const guess = /(\d{2,4})/.exec(text)
    state.agent.msgs.push({
      role: 'ai',
      text: '我先把它整理成一条候选。你看对不对——点「对，入档」才会写进记录。',
      cand: { field: /铁蛋白/.test(text) ? 'ferritin' : /输/.test(text) ? 'transfusion_hb' : 'note', value: guess ? guess[1] : text.slice(0, 24), status: 'pending' },
    })
    input.value = ''
    render()
    return
  }
})

/* 键盘：Esc 只退一层 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.pageview) { e.preventDefault(); closePageView(); return }
    if ($('#dialog').open) { $('#dialog').close() }
  }
})

/* splitter 拖动 + 键盘 */
function initSplitter() {
  const sp = $('#agent-splitter')
  if (!sp) return
  let dragging = false
  const clamp = (w) => Math.min(45, Math.max(25, w))
  sp.addEventListener('pointerdown', (e) => {
    dragging = true
    sp.setPointerCapture(e.pointerId)
  })
  sp.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const rect = $('#body').getBoundingClientRect()
    const pct = ((rect.right - e.clientX) / rect.width) * 100
    state.agent.width = clamp(Math.round(pct))
    document.body.style.setProperty('--agent-w', state.agent.width + '%')
    sp.setAttribute('aria-valuenow', String(state.agent.width))
    $$('[data-act="agent-size"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.agent.width)))
  })
  sp.addEventListener('pointerup', (e) => { dragging = false; sp.releasePointerCapture(e.pointerId) })
  sp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { state.agent.width = clamp(state.agent.width + 2); e.preventDefault() }
    if (e.key === 'ArrowRight') { state.agent.width = clamp(state.agent.width - 2); e.preventDefault() }
    document.body.style.setProperty('--agent-w', state.agent.width + '%')
    sp.setAttribute('aria-valuenow', String(state.agent.width))
  })
}

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
initSplitter()
render()
console.log(`[FerroPal prototype] ${VERSION} ${BUILD} · 页面 ${PAGES.length} 一级 / ${PAGES.reduce((a, p) => a + p.subs.length, 0)} 二级`)
