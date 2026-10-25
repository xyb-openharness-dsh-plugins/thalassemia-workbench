/**
 * 包的服务端入口（宿主加载的就是这个文件）：需要 name / inject / Config / apply 四样。
 *
 * 这一层只做四件事：
 * 1. 打开数据（配了 config.root 就用那个目录；没配就退到内存演示库，保证装上去能看见东西）；
 * 2. 过宿主鉴权（connection.requestRejection），不自己造登录；
 * 3. 把请求交给 dsh/server.js 那张**两条链路共用**的路由表（dev-server 同一份）；
 * 4. 卸载时按序关库。
 *
 * UI 走 iframe：业务界面（public/，13 个视图）是独立前端，宿主只负责把它放进面板业务区。
 * iframe 指向 `${API_PREFIX}/ui/`，页面里的接口基址按自身路径推出来（public/bootstrap.js 的 apiBase()），
 * 所以「本地 dev-server 打开」与「装进 Desktop」用同一份前端，不需要两套构建。
 */
import Schema from '@deepseek-ai/schemastery'
import { openDatabase, migrate, close } from './store.js'
import { API_PREFIX, UI_PREFIX, DB_FILE } from '../lib/identity.js'
import { seedDemo } from './demo.js'
import { bootstrap, getProfile } from './readmodels.js'
import { createApiHandler, servePublic } from './server.js'
import { CADENCE, buildFollowupPlan, checkpoints, dualCadence, addMonths } from './cadence.js'
import { version } from '../lib/version.js'

export const name = 'ferropal-workbench-main'
export const inject = ['webServer', 'connection']
export { API_PREFIX, UI_PREFIX }

export const Config = Schema.object({
  root: Schema.string().required(),
})

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length, 'cache-control': 'no-store' })
  res.end(buf)
}

function openDataSource(root) {
  const file = root ? `${root.replace(/\/+$/, '')}/${DB_FILE}` : ':memory:'
  const db = openDatabase(file)
  migrate(db)
  seedDemo(db)
  return {
    db,
    bootstrap: () => bootstrap(db, { version }),
    profile: (id) => getProfile(db, id),
    cadence: () => ({
      checks: CADENCE.checks.map((c) => ({
        code: c.code, label: c.label, interval_months: c.interval_months, ref: c.ref,
        confidence: c.confidence, alternates: c.alternates || [], note: c.note || null,
      })),
      band_note: CADENCE.band_note,
      documents: CADENCE.documents,
      helpers: { addMonths, checkpoints: (code, start) => checkpoints(code, start), plan: (opts) => buildFollowupPlan(opts), dual: (code) => dualCadence(code) },
    }),
    addTransfusion: (body) => insertTransfusion(db, body),
    addFerritin: (body) => insertFerritin(db, body),
    addQuestion: (body) => insertQuestion(db, body),
    close: () => close(db),
  }
}

/* ---------------- 写入：显式列名 + 显式问号数；失败整体回滚 ---------------- */
const now = () => new Date().toISOString()
const numOrNull = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(v))

function requireProfile(db, id) {
  const p = db.prepare('SELECT id FROM profile WHERE id = ?').get(id)
  if (!p) throw new Error('档案不存在：' + id)
  return p.id
}

export function insertTransfusion(db, body = {}) {
  const profileId = requireProfile(db, body.profile_id || 'A')
  const date = String(body.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式必须是 YYYY-MM-DD')
  const hb = numOrNull(body.hb_before)
  const units = numOrNull(body.units)
  if (hb !== null && !(hb > 0)) throw new Error('输血前 Hb 必须大于 0（不知道就留空，不要填 0）')
  const id = `${profileId}-T${Date.now().toString(36)}`
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO transfusion (id,profile_id,date,hb_before,units,volume_ml,product_type,reaction_text,site,note,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, profileId, date, hb, units, null,
      body.product_type || '未填', body.reaction_text || '无', body.site || '手工录入', null, '输血记录', now())
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  return { ok: true, id, date }
}

export function insertFerritin(db, body = {}) {
  const profileId = requireProfile(db, body.profile_id || 'A')
  const date = String(body.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式必须是 YYYY-MM-DD')
  const value = numOrNull(body.ferritin)
  if (value === null) throw new Error('铁蛋白数值不能为空')
  const id = `${profileId}-I${Date.now().toString(36)}`
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO iron_lab (id,profile_id,date,ferritin,ref_low,ref_high,lab_name,report_text,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, profileId, date, value, numOrNull(body.ref_low), numOrNull(body.ref_high),
      body.lab_name || null, body.report_text || `血清铁蛋白 ${value} ng/mL（手工补录）`, '铁蛋白趋势', now())
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  return { ok: true, id, date }
}

export function insertQuestion(db, body = {}) {
  const profileId = requireProfile(db, body.profile_id || 'A')
  const text = String(body.text || '').trim()
  if (!text) throw new Error('问题不能为空')
  const id = `${profileId}-Q${Date.now().toString(36)}`
  db.prepare(`INSERT INTO question_item (id,profile_id,text,source_page,status,created_at,section_title) VALUES (?,?,?,?,?,?,?)`)
    .run(id, profileId, text, body.source_page || 'review', 'open', now(), '就诊问题')
  return { ok: true, id }
}

export function apply(ctx, config = {}) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')

  let source = null
  let failure = null
  try {
    source = openDataSource(config.root)
  } catch (error) {
    failure = error.message
  }

  const api = createApiHandler({
    source: source ?? {
      db: null,
      bootstrap: () => { throw new Error(failure || '数据源不可用') },
      cadence: () => { throw new Error(failure || '数据源不可用') },
      addTransfusion: () => { throw new Error(failure) },
      addFerritin: () => { throw new Error(failure) },
      addQuestion: () => { throw new Error(failure) },
    },
    version,
    prefix: API_PREFIX,
  })

  const handler = (req, res) => {
    if (typeof ctx.connection?.requestRejection !== 'function') {
      return sendJson(res, 503, { error: 'connection authentication capability unavailable' })
    }
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { error: 'Authentication required' })
    return api(req, res)
  }

  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
    return () => {
      try { dispose && dispose() } catch { /* 卸载清理失败不该盖住原错误 */ }
      if (source) { try { source.close() } catch { /* 同上 */ } }
    }
  }, 'ferropal ui + api')
}

export { servePublic }
