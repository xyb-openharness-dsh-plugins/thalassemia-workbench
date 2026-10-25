/* HTTP 层：JSON 接口 + public/ 静态文件。零依赖（node:http / node:fs）。
 *
 * 三条这里说了算，别处不许再定一遍：
 * 1. 静态文件只在 public/ 内解析；`..` 一律拦掉（路径穿越），解析结果必须仍在根目录里。
 * 2. 未知 /api/* 返回 JSON 404，不返回 HTML（前端按 JSON 解析，收到 HTML 会报很难查的错）。
 * 3. workspaceProblems：资料目录必须由用户明确选择；主目录 / 桌面 / 下载 / 文档根目录、/tmp、/var 一律拒绝，
 *    父目录不存在时不静默创建，把可读错误交回调用方提示用户。
 */
import { createReadStream, statSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
export const UI_PREFIX = '/ui'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

export function workspaceProblems(p) {
  if (typeof p !== 'string' || !p.trim()) return ['资料目录不能为空：需要你明确选择一个目录']
  const target = resolve(p)
  const home = resolve(homedir())
  const problems = []
  if (target === home) problems.push('不能用主目录当资料目录（会和个人文件混在一起）')
  if (target === '/tmp' || target.startsWith('/tmp' + sep) || target === '/var' || target.startsWith('/var' + sep)) {
    problems.push('不能用 /tmp 或 /var：系统可能会清理，资料会丢')
  }
  for (const name of ['Desktop', 'Downloads', 'Documents']) {
    const d = join(home, name)
    if (target === d) problems.push(`不能用「${name}」根目录当资料目录：请在它下面新建一个目录`)
  }
  if (!existsSync(dirname(target))) problems.push(`上级目录不存在：${dirname(target)}（不自动创建，请确认你选的位置）`)
  return problems
}

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  })
  res.end(buf)
}

function readJsonBody(req, limit = 256 * 1024) {
  return new Promise((ok, fail) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { fail(new Error('请求体过大')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return ok({})
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (e) { fail(new Error('请求体不是合法 JSON')) }
    })
    req.on('error', fail)
  })
}

/** 静态文件：解析结果必须仍在 PUBLIC_DIR 内。 */
export function servePublic(req, res, urlPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' })
  let rel = decodeURIComponent(urlPath.replace(/^\/+/, ''))
  if (rel === '' || rel.endsWith('/')) rel += 'index.html'
  const target = resolve(PUBLIC_DIR, rel)
  if (!target.startsWith(PUBLIC_DIR + sep) && target !== PUBLIC_DIR) return sendJson(res, 403, { error: 'Forbidden' })
  if (rel.split(/[\\/]/).some((seg) => seg === '..')) return sendJson(res, 403, { error: 'Forbidden' })
  if (!existsSync(target) || !statSync(target).isFile()) {
    if (!extname(rel)) {
      // 单页应用回退到 index.html（#hash 深链不经过服务端，这里只兜底 /ui/xxx）
      const idx = join(PUBLIC_DIR, 'index.html')
      if (existsSync(idx)) return streamFile(req, res, idx)
    }
    return sendJson(res, 404, { error: 'Not found' })
  }
  return streamFile(req, res, target)
}

function streamFile(req, res, file) {
  res.writeHead(200, {
    'content-type': MIME[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

/**
 * 路由表：dev-server 与宿主用**同一份**（否则本地能开、装进 Desktop 就 404）。
 * @param {{source: object, version: string, prefix: string}} opts prefix 例如 '/api/ferropal-workbench'
 */
export function createApiHandler({ source, version, prefix = '' }) {
  return async function api(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1')
    const path = url.pathname

    if (!path.startsWith(prefix)) return sendJson(res, 404, { error: 'Not found' })

    if (path === `${prefix}/api/health`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      return sendJson(res, 200, {
        ok: true, version, apiVersion: 'v1',
        capabilities: ['health', 'bootstrap', 'transfusion', 'ferritin', 'question', 'cadence'],
      })
    }

    if (path === `${prefix}/api/bootstrap`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      try {
        return sendJson(res, 200, source.bootstrap())
      } catch (error) {
        return sendJson(res, 503, { error: '数据源不可用', detail: String(error.message || error) })
      }
    }

    if (path === `${prefix}/api/cadence`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      return sendJson(res, 200, source.cadence())
    }

    if (path === `${prefix}/api/transfusion` && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        return sendJson(res, 201, source.addTransfusion(body))
      } catch (error) {
        return sendJson(res, 400, { error: String(error.message || error) })
      }
    }

    if (path === `${prefix}/api/ferritin` && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        return sendJson(res, 201, source.addFerritin(body))
      } catch (error) {
        return sendJson(res, 400, { error: String(error.message || error) })
      }
    }

    if (path === `${prefix}/api/question` && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        return sendJson(res, 201, source.addQuestion(body))
      } catch (error) {
        return sendJson(res, 400, { error: String(error.message || error) })
      }
    }

    if (path.startsWith(`${prefix}${UI_PREFIX}`)) {
      return servePublic(req, res, path.slice(prefix.length + UI_PREFIX.length))
    }

    return sendJson(res, 404, { error: 'Not found' })
  }
}
