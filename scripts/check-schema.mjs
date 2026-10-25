#!/usr/bin/env node
/**
 * scripts/check-schema.mjs —— 数据模型断言（M3）
 *
 *  S1 0001_initial.sql 的 sha256 与 schema/freeze-contract.md 记录一致
 *  S2 全表无判读列（diagnosis / risk_level / severity / grade_auto / is_conclusion / is_normal）
 *  S3 metrics 的 kind/dec 互斥约束真的会拒绝反例
 *  S4 ref_high >= ref_low 约束真的会拒绝反例
 *  S5 迁移可重复执行（连跑两次不报错）
 *  S6 演示库列集合 = schema 列集合（防"演示库比 schema 多一列"）
 *  S7 每个分节读模型所需的 *_title 列都存在
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const FORBIDDEN = ['diagnosis', 'risk_level', 'severity', 'grade_auto', 'is_conclusion', 'is_normal']
const errors = []
const { DatabaseSync } = await import('node:sqlite')

const sqlPath = join(ROOT, 'schema/0001_initial.sql')
const sql = readFileSync(sqlPath, 'utf8')
const sha = createHash('sha256').update(sql).digest('hex')

// S1
const contract = readFileSync(join(ROOT, 'schema/freeze-contract.md'), 'utf8')
const declared = (contract.match(/sha256\*\*：`([0-9a-f]{64})`/) || [])[1]
if (declared !== sha) errors.push(`S1 sha256 不符：文件 ${sha.slice(0, 12)}… ≠ 契约 ${(declared || '缺失').slice(0, 12)}…`)

const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON')
const { migrate } = await import('../dsh/store.js')
const applied = migrate(db)
// S5
try {
  const again = migrate(db)
  if (again.length !== 0) errors.push('S5 迁移不幂等：第二次又执行了 ' + again.join(','))
} catch (e) { errors.push('S5 迁移不可重复执行：' + e.message) }

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'").all().map((r) => r.name)

// S2
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name)
  for (const bad of FORBIDDEN) {
    if (cols.includes(bad)) errors.push(`S2 判读列出现在 ${t}.${bad}`)
  }
}

// S3 / S4 反例
const tryInsert = (label, fn) => {
  try { fn(); errors.push(`${label} 未被约束拒绝（应当拒绝）`) } catch { /* 期望被拒绝 */ }
}
tryInsert('S3 分类值 + 数值同时存在', () => db.prepare(
  `INSERT INTO metrics (id,profile_id,kind,code,date,value_num,value_text,unit,ref_low,ref_high,dec,ord,in_use,note,created_at)
   VALUES ('x1','p','qual','milestone','2026-01-01',12,NULL,NULL,NULL,NULL,'确诊',1,1,NULL,'2026-01-01')`).run())
tryInsert('S3 数值型缺 value_num', () => db.prepare(
  `INSERT INTO metrics (id,profile_id,kind,code,date,value_num,value_text,unit,ref_low,ref_high,dec,ord,in_use,note,created_at)
   VALUES ('x2','p','numeric','hb','2026-01-01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'2026-01-01')`).run())
tryInsert('S4 ref_high < ref_low', () => db.prepare(
  `INSERT INTO iron_lab (id,profile_id,date,ferritin,ref_low,ref_high,lab_name,report_text,section_title,created_at)
   VALUES ('y1','p','2026-01-01',100,500,300,NULL,NULL,'铁蛋白趋势','2026-01-01')`).run())
tryInsert('S4 负金额', () => db.prepare(
  `INSERT INTO cost_record (id,profile_id,date,category,amount_cents,insurance_flag,note,section_title,created_at)
   VALUES ('z1','p','2026-01-01','other',-1,NULL,NULL,'费用记录','2026-01-01')`).run())

// S7 分节标题列
const needsTitle = ['profile', 'docs', 'transfusion', 'iron_lab', 'chelation_plan', 't2star_report',
  'growth_measure', 'screening_item', 'antibody_record', 'cost_record', 'question_item']
for (const t of needsTitle) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name)
  if (!cols.includes('section_title')) errors.push(`S7 ${t} 缺 section_title 列`)
}

// S6 演示库列集合
const demoPath = join(ROOT, 'demo/demo-data.sqlite')
if (existsSync(demoPath)) {
  const demo = new DatabaseSync(demoPath, { readOnly: true })
  const demoTables = demo.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name)
  for (const t of tables) {
    if (!demoTables.includes(t)) { errors.push(`S6 演示库缺表 ${t}`); continue }
    const a = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name).sort().join(',')
    const b = demo.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name).sort().join(',')
    if (a !== b) errors.push(`S6 演示库列与 schema 不一致：${t}`)
  }
  demo.close()
} else {
  errors.push('S6 缺少 demo/demo-data.sqlite（先跑 npm run build:demo）')
}

db.close()
console.log(JSON.stringify({ sha256: sha.slice(0, 12) + '…', tables: tables.length, errors }, null, 2))
process.exit(errors.length ? 1 : 0)
