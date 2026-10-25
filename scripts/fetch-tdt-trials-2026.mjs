#!/usr/bin/env node
/** Read-only MCP search; writes only project assets/clinical, never user config or upstream indexes. */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = join(ROOT, 'assets/clinical')
const MCP = join(process.env.HOME || '', 'Downloads/unified_search_trials')
const ENTRY = join(MCP, 'dist/src/cli/main.js')
const sourceIds = ['ictrp', 'ctv', 'chictr_online', 'chinadrugtrials']
const queries = ['thalassemia', '地中海贫血'].map(keyword => ({
  keyword, sourceIds, startDateFrom: '2026-01-25', startDateTo: '2026-10-25', limit: 200, offset: 0,
}))
const plan = { sourceIds, queries, dateSemantics: 'study start date; not registry update date', output: OUT,
  warning: 'requested 9-month study-start filter; upstream enforcement unverified; first-page raw candidate snapshot; failed sources are not zero results' }
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ dryRun: true, entryExists: existsSync(ENTRY), ...plan }, null, 2))
  process.exit(0)
}
if (!existsSync(ENTRY)) throw new Error('MCP compiled entry unavailable; no installation attempted')
const sdk = join(MCP, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client')
const { Client } = await import(pathToFileURL(join(sdk, 'index.js')).href)
const { StdioClientTransport } = await import(pathToFileURL(join(sdk, 'stdio.js')).href)
// No config/credential overrides. Existing MCP configuration is read by its supported entry.
const transport = new StdioClientTransport({ command: process.execPath, args: [ENTRY, 'serve'], stderr: 'ignore' })
const client = new Client({ name: 'ferropal-trial-collector', version: '0.2.0' })
const calls = []
function payload(result) {
  if (result.structuredContent) return result.structuredContent
  const text = result.content?.find(c => c.type === 'text')?.text
  try { return JSON.parse(text) } catch { return { isError: true, explanation: 'Non-JSON MCP response', text } }
}
async function call(name, args) {
  const startedAt = new Date().toISOString()
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 })
    const data = payload(result)
    const item = { name, args, startedAt, completedAt: new Date().toISOString(), isError: Boolean(result.isError), data }
    calls.push(item)
    console.log(JSON.stringify({ tool: name, records: data.totalRecords ?? null, statuses: data.statuses?.map(s => ({ source: s.sourceId, state: s.state, reasonCode: s.reasonCode, attempted: s.attempted })) }))
    return data
  } catch (error) {
    const item = { name, args, startedAt, completedAt: new Date().toISOString(), isError: true, data: { error: error.message } }
    calls.push(item)
    console.log(JSON.stringify({ tool: name, error: error.message }))
    return item.data
  }
}
try {
  const replay = process.argv.includes('--rebuild-assets')
  if (replay) calls.push(...JSON.parse(readFileSync(join(OUT, 'query-responses.json'), 'utf8')).calls)
  else {
    await client.connect(transport)
    await call('get_source_status', {})
    for (const query of queries) await call('search_trials', query)
  }
  const records = calls.filter(c => c.name === 'search_trials').flatMap(c => c.data.records || [])
  // Group only by a confirmed normalized registration identifier, never by title similarity.
  const groups = new Map()
  for (const record of records) {
    const registration = record.registryNumbers?.find(n => n.primary) || record.registryNumbers?.[0]
    const key = registration ? `${registration.registry}:${registration.value}` : record.recordId
    const group = groups.get(key)
    if (group) group.members.push(record)
    else groups.set(key, { recordId: record.recordId, registrationIdentity: key, members: [record] })
  }
  const unique = [...groups.values()]
  for (const record of (replay ? [] : unique.slice(0, 2))) {
    const recordId = record.recordId
    if (typeof recordId === 'string') {
      await call('get_trial_detail', { recordId })
      await call('get_record_evidence', { recordId })
    }
  }
  mkdirSync(OUT, { recursive: true })
  const jsonl = unique.map(r => JSON.stringify(r)).join('\n') + (unique.length ? '\n' : '')
  writeFileSync(join(OUT, 'trials-2026.jsonl'), jsonl)
  writeFileSync(join(OUT, 'query-responses.json'), JSON.stringify({ plan, calls }, null, 2) + '\n')
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(join(OUT, 'tdt_trials_2026.sqlite'))
  db.exec('CREATE TABLE IF NOT EXISTS trials (id TEXT PRIMARY KEY, raw_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS source_status (query_no INTEGER NOT NULL, source TEXT NOT NULL, terminal TEXT NOT NULL, raw_json TEXT NOT NULL, PRIMARY KEY(query_no,source));')
  db.exec('BEGIN; DELETE FROM trials; DELETE FROM source_status;')
  const insert = db.prepare('INSERT INTO trials VALUES (?,?)')
  for (const record of unique) { const text = JSON.stringify(record); insert.run(createHash('sha256').update(text).digest('hex'), text) }
  const statusInsert = db.prepare('INSERT INTO source_status VALUES (?,?,?,?)')
  const searches = calls.filter(c => c.name === 'search_trials')
  searches.forEach((c, i) => { for (const s of c.data.statuses || []) statusInsert.run(i, s.sourceId, s.state, JSON.stringify(s)) })
  db.exec('COMMIT')
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check
  const rows = db.prepare('SELECT COUNT(*) AS n FROM trials').get().n
  const sourceRows = db.prepare('SELECT COUNT(*) AS n FROM source_status').get().n
  db.close()
  const dateAudit = { requestedField: 'study start date', verifiedInWindow: 0, outsideWindow: 0, unknownStartDate: 0 }
  for (const record of unique) {
    const start = record.members.map(m => m.dates?.start).find(Boolean)
    if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start)) dateAudit.unknownStartDate++
    else if (start >= '2026-01-25' && start <= '2026-10-25') dateAudit.verifiedInWindow++
    else dateAudit.outsideWindow++
  }
  const manifest = { dataset: 'tdt-trials-2026-mcp-run', generated_at: new Date().toISOString(), data_cutoff: '2026-10-25', ...plan,
    candidateOnly: true, dateAudit, rawCandidateCount: records.length, uniqueRegistrationCount: unique.length,
    coverage: 'partial; truncated English ICTRP; failed Chinese ICTRP; unavailable CTV/ChiCTR; unverified date filtering',
    collectionSucceeded: true, clinicalCoverageComplete: false, exitZeroMeaning: 'assets written and integrity checked, not all sources succeeded',
    dateWarning: 'Query date parameters do not prove upstream enforcement. Unverifiable dates remain raw candidates, not accepted in-window trials.',
    records: unique.length, sqlite_rows: rows, source_status_rows: sourceRows, integrity,
    jsonl_sha256: createHash('sha256').update(jsonl).digest('hex'), consistency: rows === unique.length && integrity === 'ok',
    calls: calls.map(({ name, args, startedAt, completedAt, isError }) => ({ name, args, startedAt, completedAt, isError })),
    offlineCoverage: 'Pancreatic-only corpora excluded; no thalassemia coverage claimed',
    disclaimer: '登记≠有效≠安全≠可入组。Source failure is not NO_RESULTS. Exact raw status/coverage/completeness in query-responses.json.',
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ output: OUT, records: rows, sourceStatusRows: sourceRows, integrity, consistency: manifest.consistency }))
} finally {
  await client.close()
  await transport.close()
}
