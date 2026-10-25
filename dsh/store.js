/* 数据层：开库 / 迁移 / 关库。零业务判断。
 *
 * 约定（与 docs/SCHEMA.md、schema/freeze-contract.md 一致）：
 * - 迁移只增不改：schema/*.sql 按文件名排序依次执行，全部 IF NOT EXISTS，可重复跑。
 * - 派生值（输血间隔、百分位）不落库，读的时候算。
 * - 复合主键表裸 SELECT 一律 ORDER BY rowid；手写倒序只 ORDER BY ord。
 */
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCHEMA_DIR = fileURLToPath(new URL('../schema', import.meta.url))

export function migrationFiles(dir = SCHEMA_DIR) {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ name: f, path: join(dir, f), sql: readFileSync(join(dir, f), 'utf8') }))
}

export async function openDatabase(file) {
  const { DatabaseSync } = await import('node:sqlite')
  // SQLite 只建库文件、不建父目录；宿主的 dshHomePath() 也不建。
  // 少了这一步，首次装机就会 ERR_SQLITE_ERROR(14) unable to open database file。
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

/** 迁移幂等：用 schema_migrations 记账，已应用的跳过（0002 这类 ALTER 不能重复执行）。
 *  返回本次**实际执行**的文件名数组；重复调用返回空数组。 */
export function migrate(db, dir) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name))
  const applied = []
  for (const m of migrationFiles(dir)) {
    if (done.has(m.name)) continue
    db.exec(m.sql)
    db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(m.name, new Date().toISOString())
    applied.push(m.name)
  }
  return applied
}

export function close(db) {
  try { db.close() } catch { /* 已关闭 */ }
}

/** 冒烟：库里有几个档案。空库返回 0，不抛错。 */
export function profileCount(db) {
  try { return db.prepare('SELECT COUNT(*) AS n FROM profile').get().n } catch { return 0 }
}

export const DB_FILE = 'xyb-ferropal.sqlite'
