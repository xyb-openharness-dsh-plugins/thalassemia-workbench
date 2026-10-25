/* 数据注入层：把本机 API 的 /api/bootstrap 结果放进 window.DEMO_DATA，再加载 app.js。
 *
 * 为什么这样做：app.js 与 style.css 与原型 prototypes/v0.2/ **字节一致**（parity 可断言），
 * 数据形状也一致（dsh/readmodels.js 按 demo-data.js 的形状还原）。前端只有这一层知道"数据从哪来"。
 *
 * 契约（与 starter 14 号一致，别改）：
 *   API_BASE = 挂载前缀（独立启动 ''，宿主 '/api/ferropal-workbench'），页面统一拼 `${API_BASE}/api/xxx`；
 *   守卫只禁交界重复 '/api/api'，不用 includes('/api') 一刀切（宿主前缀含 /api 是正常的）。
 */
(function () {
  'use strict'

  function apiBase() {
    const m = location.pathname.match(/^(.*)\/ui\/?/)
    return m ? m[1].replace(/\/$/, '') : ''
  }

  function assertBase(base) {
    if (/\/api\/api(\/|$)/.test(base)) return '接口基址重复了 /api：' + base
    if (!/^$|^\/[\w./-]*$/.test(base)) return '接口基址不合法：' + base
    return ''
  }

  function banner(message) {
    const main = document.getElementById('main')
    if (!main) return
    main.innerHTML =
      '<div class="card" role="alert"><div class="card-head"><div class="title"><b>页面没能读到本机数据</b>' +
      '<span>常见原因：Harness 刚重启、插件还没加载完、或资料目录没选。</span></div></div>' +
      '<p>' + String(message).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] }) + '</p>' +
      '<p class="note-line">数据都在你本机；这里不重试上传、不外发。</p></div>'
  }

  var base = apiBase()
  var problem = assertBase(base)
  if (problem) { banner(problem); return }

  fetch(base + '/api/bootstrap', { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('服务返回 ' + res.status)
      return res.json()
    })
    .then(function (data) {
      if (!data || !data.profiles || !Object.keys(data.profiles).length) throw new Error('本机库里还没有档案')
      window.DEMO_DATA = data
      var el = document.getElementById('data-source')
      if (el) el.textContent = '数据截止 ' + data.data_end + ' · 全部在本机'
      var s = document.createElement('script')
      s.src = 'app.js'
      s.onerror = function () { banner('app.js 加载失败') }
      document.body.appendChild(s)
    })
    .catch(function (err) { banner(err && err.message ? err.message : err) })
})()
