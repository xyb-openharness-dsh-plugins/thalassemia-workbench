#!/usr/bin/env node
/**
 * scripts/fetch-tdt-trials-2026.mjs —— 临床研究库采集（四通道 MCP 口径）
 *
 * 唯一入口是 unified-trial-mcp（MCP stdio）。本机未安装时**不伪造结果**：
 *   逐通道终态写 not_queried，manifest.records = 0，jsonl 为空，sqlite 为空表。
 *
 * 交付四件套：
 *   research/tdt/manifest.json
 *   research/tdt/trials-2026.jsonl
 *   research/tdt/tdt_trials_2026.sqlite
 *   research/tdt/README.md
 *
 * 用法：
 *   node scripts/fetch-tdt-trials-2026.mjs --dry-run      # 只打印将发的查询与通道，不写文件
 *   node scripts/fetch-tdt-trials-2026.mjs                # 实跑（无 MCP 时写"未查过"终态）
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'research/tdt')
const DATA_CUTOFF = '2026-10-25'
const DRY = process.argv.includes('--dry-run')

const KEYWORDS = ['地中海贫血', 'thalassemia', 'thalassaemia', '输血依赖', '去铁', '铁过载', 'β-地中海贫血']
const CHANNELS = [
  { id: 'ictrp', label: 'WHO ICTRP', kind: 'online', note: '全球广度' },
  { id: 'ctv', label: 'Veeva CTV / ClinicalTrials.gov', kind: 'index', note: '需本地索引' },
  { id: 'chictr_online', label: 'ChiCTR 实时', kind: 'online', note: '中国注册' },
  { id: 'chinadrugtrials', label: 'CDE 药物临床试验登记', kind: 'online', note: '含研究者 PI' },
  { id: 'chictr_corpus', label: 'ChiCTR 离线语料', kind: 'offline', note: '已知仅覆盖胰腺癌' },
  { id: 'xyb_archive', label: '小胰宝归档', kind: 'offline', note: '已知仅覆盖胰腺癌' },
]

function mcpAvailable() {
  // 工具契约：不自己拼 URL，只认 MCP 入口
  const candidates = [
    join(process.env.HOME || '', 'Downloads/unified_search_trials'),
    join(process.env.HOME || '', 'Downloads/unified-trial-search-mcp-service'),
  ]
  return candidates.find((p) => existsSync(join(p, 'package.json'))) || null
}

const mcpPath = mcpAvailable()
const status = (ch) => {
  if (!mcpPath) return { state: 'not_queried', detail: 'unified-trial-mcp 未安装（本机无 ~/Downloads/unified_search_trials）' }
  if (ch.kind === 'offline') return { state: 'not_configured', detail: '离线语料只覆盖胰腺癌，地贫无覆盖' }
  return { state: 'not_queried', detail: 'MCP 已安装但本次未执行查询（需显式调用维护类工具）' }
}

const channels = CHANNELS.map((ch) => ({ ...ch, terminal: status(ch), hits: 0 }))
const records = []

if (DRY) {
  console.log(JSON.stringify({
    dryRun: true,
    dataCutoff: DATA_CUTOFF,
    mcp: mcpPath || 'not-installed',
    keywords: KEYWORDS,
    channels: channels.map((c) => ({ id: c.id, terminal: c.terminal.state })),
    note: '未写任何文件',
  }, null, 2))
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })

/* jsonl：本轮 0 行 */
const jsonl = records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '')
writeFileSync(join(OUT, 'trials-2026.jsonl'), jsonl)

/* sqlite：空表，结构与家族一致 */
const { DatabaseSync } = await import('node:sqlite')
const dbPath = join(OUT, 'tdt_trials_2026.sqlite')
if (existsSync(dbPath)) { const { rmSync } = await import('node:fs'); rmSync(dbPath) }
const db = new DatabaseSync(dbPath)
db.exec(`
CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT, registry_no TEXT,
  title TEXT, status_text TEXT, phase TEXT, sponsor TEXT, pi TEXT,
  enrollment INTEGER, start_date TEXT, url TEXT, fetched_at TEXT NOT NULL,
  raw_json TEXT
);
CREATE TABLE IF NOT EXISTS source_status (
  source TEXT PRIMARY KEY, terminal TEXT NOT NULL, detail TEXT, hits INTEGER NOT NULL DEFAULT 0,
  data_cutoff TEXT NOT NULL, checked_at TEXT
);
`)
const ins = db.prepare(`INSERT INTO source_status (source,terminal,detail,hits,data_cutoff,checked_at) VALUES (?,?,?,?,?,?)`)
for (const c of channels) ins.run(c.id, c.terminal.state, c.terminal.detail, 0, DATA_CUTOFF, null)
const sqliteCount = db.prepare('SELECT COUNT(*) AS n FROM trials').get().n
db.close()

/* manifest：记录数三处一致 */
const manifest = {
  dataset: 'tdt-trials-2026',
  data_cutoff: DATA_CUTOFF,
  generated_at: new Date().toISOString(),
  mcp: { path: mcpPath, available: Boolean(mcpPath) },
  keywords: KEYWORDS,
  channels: channels.map((c) => ({ id: c.id, label: c.label, kind: c.kind, terminal: c.terminal.state, detail: c.terminal.detail, hits: 0 })),
  records: records.length,
  jsonl_sha256: createHash('sha256').update(jsonl).digest('hex'),
  sqlite_rows: sqliteCount,
  consistency: records.length === sqliteCount,
  coverage_note: '本轮**未查过**任何通道；0 条不等于"不存在"。登记 ≠ 有效 ≠ 安全 ≠ 可入组。',
  honest_limits: [
    'unified-trial-mcp 未安装，四通道均未查询（not_queried）',
    '两个离线语料只覆盖胰腺癌，地贫属 not_configured',
    '登记状态未核实，界面不得显示为"可入组"',
  ],
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(join(OUT, 'README.md'), `# 地贫临床研究库（2026 采集）

> **本轮未查过。** manifest.records = 0，jsonl 0 行，sqlite 0 行——三者一致。
> 0 条 ≠ 不存在；本文件不提供任何"某药在某试验中有效"的说法。

- 数据截止日：${DATA_CUTOFF}
- 采集方式：unified-trial-mcp（MCP stdio，四通道）。本机检查结果：**未安装**。
- 逐通道终态见 \`manifest.json\` 的 \`channels[].terminal\`（全部 \`not_queried\` / \`not_configured\`）。
- 口径文档：[\`docs/CLINICAL-DATA-2026.md\`](../../docs/CLINICAL-DATA-2026.md)

## 复采步骤

1. \`git clone git@github.com:opencare-skillhub/unified-trial-search-mcp-service.git ~/Downloads/unified_search_trials\`
2. \`npm install && npm run build && npm run doctor\`（四通道 \`get_source_status\` 必须全通）
3. \`node scripts/fetch-tdt-trials-2026.mjs --dry-run\` 核对待发查询
4. \`node scripts/fetch-tdt-trials-2026.mjs\` 实跑，检查三处记录数一致
`)

const assertOk = records.length === sqliteCount
console.log(JSON.stringify({
  ok: assertOk, records: records.length, jsonlBytes: Buffer.byteLength(jsonl), sqliteRows: sqliteCount,
  channels: manifest.channels.map((c) => `${c.id}:${c.terminal}`), out: OUT,
}, null, 2))
process.exit(assertOk ? 0 : 1)
