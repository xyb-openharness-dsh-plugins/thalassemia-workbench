#!/usr/bin/env node
/* 独立启动：与宿主用同一份 store/readmodels/server（否则"本地能开、装进去 404"）。
 *   npm start -- --root <资料目录> [--port 8787]
 * 不给 --root 时用仓内 .devroot/（仅本地开发，不是用户资料目录）。
 */
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabase, migrate, close, DB_FILE } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { bootstrap, getProfile } from '../dsh/readmodels.js'
import { createApiHandler } from '../dsh/server.js'
import { version } from '../lib/version.js'

const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : undefined }
const port = Number(arg('port') || process.env.PORT || 8787)
const root = arg('root') || join(import.meta.dirname, '..', '.devroot')
mkdirSync(root, { recursive: true })

const db = await openDatabase(join(root, DB_FILE))
migrate(db)
seedDemo(db)

const api = createApiHandler({
  source: {
    bootstrap: () => bootstrap(db, { version }),
    cadence: () => ({ checks: [] }),
    addTransfusion: () => { throw new Error('dev-server 只读') },
    addFerritin: () => { throw new Error('dev-server 只读') },
    addQuestion: () => { throw new Error('dev-server 只读') },
  },
  version,
  prefix: '',
})

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname === '/') { res.writeHead(302, { location: '/ui/' }); return res.end() }
  if (url.pathname === '/api/health' || url.pathname === '/api/bootstrap' || url.pathname.startsWith('/ui')) return api(req, res)
  res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"Not found"}')
})

server.listen(port, '127.0.0.1', () => {
  console.log(`FerroPal dev-server v${version} → http://127.0.0.1:${port}/ui/  (root=${root})`)
})
process.on('SIGINT', () => { close(db); server.close(() => process.exit(0)) })
