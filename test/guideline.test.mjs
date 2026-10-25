/* G1/G2 登记一致性 + 版权边界（三处登记必须逐字相同；原件不入包）。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = join(import.meta.dirname, '..')
const refs = JSON.parse(readFileSync(join(ROOT, 'assets/reference/guideline/refs.json'), 'utf8'))
const cadence = JSON.parse(readFileSync(join(ROOT, 'assets/reference/guideline/cadence.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(ROOT, 'guidebooks/manifest.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

test('三处登记的 id / published 一致', () => {
  for (const doc of refs.documents) {
    const c = cadence.documents.find((d) => d.id === doc.id)
    const m = manifest.documents.find((d) => d.id === doc.id)
    assert.ok(c, `cadence.json 缺 ${doc.id}`)
    assert.ok(m, `guidebooks/manifest.json 缺 ${doc.id}`)
    assert.equal(c.published, doc.published, `${doc.id} published 不一致`)
    assert.equal(m.published, doc.published, `${doc.id} manifest published 不一致`)
  }
})

test('每条例证 ≤200 字符，且页码/文档齐备', () => {
  for (const r of refs.refs) {
    assert.ok(r.excerpt.length <= 200, `${r.id} 摘录 ${r.excerpt.length} 字符 > 200`)
    assert.ok(r.page_pdf > 0, `${r.id} 缺 page_pdf`)
    assert.ok(refs.documents.some((d) => d.id === r.doc), `${r.id} 指向不存在的文档 ${r.doc}`)
  }
})

test('cadence 引用的 ref 都存在', () => {
  for (const c of cadence.checks) {
    if (c.ref) assert.ok(refs.refs.some((r) => r.id === c.ref), `${c.code} 引用了不存在的 ${c.ref}`)
    for (const a of c.alternates || []) {
      assert.ok(refs.refs.some((r) => r.id === a.ref), `${c.code} alternates 引用了不存在的 ${a.ref}`)
    }
  }
})

test('原件不入包：files 白名单里没有 guidebooks，也没有 PDF', () => {
  for (const f of pkg.files) {
    assert.ok(!/^guidebooks/.test(f), `files 里出现 guidebooks：${f}`)
    assert.ok(!/\.pdf$/i.test(f), `files 里出现 PDF：${f}`)
  }
})

test('原件 sha256 与 manifest 一致（本机有原件时）', () => {
  for (const d of manifest.documents) {
    if (!d.file) continue
    const p = join(ROOT, d.file)
    if (!existsSync(p)) continue // 原件不入仓（.gitignore），本机缺失不算失败
    const sha = createHash('sha256').update(readFileSync(p)).digest('hex')
    assert.equal(sha, d.sha256, `${d.id} sha256 不符`)
  }
})

test('界面出处块引用的 G1 编号都在 refs.json 里', () => {
  const app = readFileSync(join(ROOT, 'public/app.js'), 'utf8')
  const block = app.slice(app.indexOf('const GUIDE_REFS'), app.indexOf('/** 两段式出处块'))
  const ids = [...block.matchAll(/'(G1-\d+)':/g)].map((m) => m[1])
  assert.ok(ids.length >= 6, '界面至少要接 6 条出处')
  for (const id of ids) assert.ok(refs.refs.some((r) => r.id === id), `界面引用了不存在的 ${id}`)
})
