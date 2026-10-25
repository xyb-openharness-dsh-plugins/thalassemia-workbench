#!/usr/bin/env node
/* 演示库 ↔ schema 列一致 + 临床库三处记录数一致（manifest = jsonl = sqlite）。 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const errors = []
const { DatabaseSync } = await import('node:sqlite')

const { migrate } = await import('../dsh/store.js')
const schema = new DatabaseSync(':memory:')
migrate(schema)
const tables = schema.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'").all().map((r) => r.name)

const demoPath = join(ROOT, 'demo/demo-data.sqlite')
if (!existsSync(demoPath)) errors.push('缺 demo/demo-data.sqlite（先 npm run build:demo）')
else {
  const demo = new DatabaseSync(demoPath, { readOnly: true })
  for (const t of tables) {
    const a = schema.prepare(`PRAGMA table_info(${t})`).all().map((c) => `${c.name}:${c.type}`).join(',')
    const b = demo.prepare(`PRAGMA table_info(${t})`).all().map((c) => `${c.name}:${c.type}`).join(',')
    if (a !== b) errors.push(`演示库列与 schema 不一致：${t}`)
  }
  const n = demo.prepare('SELECT COUNT(*) AS n FROM transfusion').get().n
  if (!(n > 0)) errors.push('演示库 transfusion 0 行（演示数据没播进去）')
  demo.close()
}

// 临床库三处一致
const manPath = join(ROOT, 'research/tdt/manifest.json')
if (existsSync(manPath)) {
  const man = JSON.parse(readFileSync(manPath, 'utf8'))
  const jsonl = readFileSync(join(ROOT, 'research/tdt/trials-2026.jsonl'), 'utf8').split('\n').filter(Boolean).length
  const db = new DatabaseSync(join(ROOT, 'research/tdt/tdt_trials_2026.sqlite'), { readOnly: true })
  const rows = db.prepare('SELECT COUNT(*) AS n FROM trials').get().n
  db.close()
  if (!(man.records === jsonl && jsonl === rows)) errors.push(`临床库三处不一致：manifest ${man.records} / jsonl ${jsonl} / sqlite ${rows}`)
  if (man.records === 0 && !/未查过/.test(man.coverage_note || '')) errors.push('0 条时必须写「未查过」覆盖声明')
} else if (!['--allow-missing-trials'].length) {
  errors.push('缺 research/tdt/manifest.json（先跑 npm run fetch:trials）')
}

console.log(JSON.stringify({ tables: tables.length, errors }, null, 2))
process.exit(errors.length ? 1 : 0)
