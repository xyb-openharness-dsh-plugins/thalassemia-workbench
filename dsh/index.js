import Schema from '@deepseek-ai/schemastery'
import { readFileSync } from 'node:fs'

export const name = 'ferropal-workbench-main'
export const inject = ['webServer', 'connection']
/* 宿主注入的本机数据目录（cordis.patch.yml: config.root: !!js dshHomePath('ferropal-workbench')）。
   声明为 required 是有意的：漏注入时装机能打开、每次重启回到内存库——静默失败比报错难查十倍。 */
export const Config = Schema.object({
  root: Schema.string().required(),
})
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export function apply(ctx) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/api/ferropal-workbench/health',
    handler(req, res) {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      if (typeof ctx.connection?.requestRejection !== 'function') return send(503, { error: 'connection authentication capability unavailable' })
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) return send(rejection, { error: 'Authentication required' })
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed' })
      send(200, { ok: true, version: manifest.version, apiVersion: 'v1', capabilities: ['health'] })
    },
  }), 'ferropal-workbench health')
}
