/* 客户端入口源码（不要直接改 lib/client.js —— 那是 build:client 的产物）。
 *
 * customFrame：宿主把原生会话节点作为 conversation 交给我们排版，所以这里自己画
 * 顶栏（品牌 + AI 开关）、左侧业务区（iframe 指向 `${API_PREFIX}/ui/`）、右侧会话区、中间 splitter。
 *
 * 五态：关闭 / 打开 / 收起（=关闭但不结束会话）/ 调宽（25%–45%）/ 无会话时降级提示。
 * 三条硬约束：
 * 1. 根节点首个子元素是语义 <header>，并用 --dsh-frame-leading-clearance 避让 macOS 窗口按钮；
 * 2. 原生会话始终挂载（只用 display 控制显隐），卸载会丢输入框状态；
 * 3. 没有会话时业务照常可用；拿不到宿主服务一律降级提示，不猜第二个入口。
 *
 * 业务区 iframe ↔ 宿主草稿桥（IP10 / F10）：
 *   请求 iframe → 父：{ type: 'ferropal:agent-draft', requestId, prompt }
 *   结果 父 → iframe：{ type: 'ferropal:agent-draft-result', requestId, ok, error? }
 * 只写草稿、**不发送**；只在用户点了业务页按钮（iframe 主动发消息）时才动作，
 * 首次进页面不建会话。写失败一律回 ok:false，不谎报"已接通"。
 *
 * 服务获取用 ctx.get(name)（Cordis 官方的"不声明 inject 也能读"口径，见
 * @deepseek-ai/cordis src/reflect.ts 的 services 注释）。**不把 'sessions' 写进 inject**：
 * 那会让没有该服务的宿主整包停在 INACTIVE、apply 根本不执行。
 */
;(function () {
  if (typeof window === 'undefined' || typeof window.__ModuleLoader__?.load !== 'function') return

  window.__ModuleLoader__.load({
    id: "@ferropal-dsh/thalassemia-workbench",
    factory(require) {
      const React = require('react')
      const h = React.createElement
      const metadata = { title: "小铁宝 FerroPal · 重型地中海贫血工作台", description: "本机优先的重型地中海贫血（输血依赖型）输血—去铁循环、血清铁蛋白与生长发育随访、遗传与生育咨询准备工作台" }
      const VERSION = "0.4.0"
      const BUILD = "2026-10-25"
      const API_PREFIX = "/api/ferropal-workbench"
      const UI_ENTRY = "/api/ferropal-workbench/ui/"
      const PANE = {"min":25,"max":45,"default":35,"step":2,"drawerBelowPx":760}
      const STORE_KEY = 'ferropal.agent.width'

      const clamp = (n) => Math.min(PANE.max, Math.max(PANE.min, Math.round(Number(n) || PANE.default)))

      /** apply(ctx) 时记下根 ctx，供 Panel 里读宿主服务（家族同款写法：不把 ctx 塞进 props）。 */
      let bridge = null

      /* ---------------- iframe ↔ 宿主草稿桥（纯函数，可单测） ---------------- */
      const DRAFT_REQUEST = 'ferropal:agent-draft'
      const DRAFT_RESULT = 'ferropal:agent-draft-result'
      const DRAFT_PROMPT_MAX = 4000
      const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,64}$/

      /** 严格校验一条来自 iframe 的草稿请求；返回 {ok:true, requestId, prompt} 或 {ok:false, requestId, error}。 */
      function readDraftRequest(raw) {
        if (!raw || typeof raw !== 'object') return { ok: false, requestId: null, error: '消息不是对象' }
        if (raw.type !== DRAFT_REQUEST) return { ok: false, requestId: null, error: '消息类型不匹配' }
        const requestId = typeof raw.requestId === 'string' && REQUEST_ID_RE.test(raw.requestId) ? raw.requestId : null
        if (!requestId) return { ok: false, requestId: null, error: 'requestId 缺失或不合法' }
        if (typeof raw.prompt !== 'string') return { ok: false, requestId, error: 'prompt 必须是字符串' }
        const prompt = raw.prompt.trim()
        if (!prompt) return { ok: false, requestId, error: 'prompt 是空的' }
        if (prompt.length > DRAFT_PROMPT_MAX) return { ok: false, requestId, error: 'prompt 超长（上限 ' + DRAFT_PROMPT_MAX + ' 字）' }
        return { ok: true, requestId, prompt }
      }

      /** 消息来源必须是我自己那个 iframe，且同源。收不到 frame 一律拒绝。 */
      function isTrustedSource(event, frame, origin) {
        if (!frame || !event) return false
        if (event.source !== frame.contentWindow) return false
        return event.origin === origin
      }

      /**
       * 把 prompt 写进宿主原生会话草稿（只填入、不发送）。
       * 拿不到任何一环都抛出带人话的错误，调用方据此回 ok:false。
       */
      function writeDraft(ctx, prompt, sessionId) {
        if (!ctx || typeof ctx.get !== 'function') throw new Error('宿主服务不可用（apply 尚未执行）')
        const service = ctx.get('desktopWorkbenches')
        const sessions = ctx.get('sessions')
        if (!sessions || typeof sessions.scope !== 'function') throw new Error('宿主未提供会话服务（sessions.scope 不可用）')
        const id = sessionId || (typeof service?.currentSession === 'function' ? service.currentSession() : null)
        if (!id) throw new Error('还没有本工作台的会话，先打开一次 AI 对话再试')
        if (typeof service?.ownsSession === 'function' && !service.ownsSession(id)) throw new Error('当前会话不属于本工作台')
        const actx = sessions.scope(id)
        if (!actx) throw new Error('会话尚未就绪（scope 取不到）')
        const conversation = actx.get('conversation')
        if (!conversation || !conversation.input || typeof conversation.input.for !== 'function') {
          throw new Error('对话输入不可用')
        }
        let input
        try {
          input = conversation.input.for(actx)
        } catch (error) {
          // 宿主在会话没有 retained scope 时抛的是英文错误，转成用户能看懂的一句。
          throw new Error('会话尚未就绪（输入框还没挂上来）：' + String(error && error.message ? error.message : error))
        }
        const snapshot = input.state.getSnapshot()
        if ((snapshot.occurrences && snapshot.occurrences.length) || (snapshot.phase && snapshot.phase !== 'plain')) {
          throw new Error('当前草稿含引用或特殊输入，请先在会话里处理，再带过来')
        }
        const current = snapshot.draft || ''
        input.setDraft(current.trim() ? current + '\n\n' + prompt : prompt)
        return { sessionId: id, appended: Boolean(current.trim()) }
      }

      function readWidth() {
        try {
          const raw = window.localStorage.getItem(STORE_KEY)
          return raw ? clamp(Number(raw)) : PANE.default
        } catch { return PANE.default }
      }

      function saveWidth(n) {
        try { window.localStorage.setItem(STORE_KEY, String(n)) } catch { /* 隐私模式忽略 */ }
      }

      function Panel(props) {
        const [width, setWidth] = React.useState(readWidth)
        const [open, setOpen] = React.useState(false)
        const [containerW, setContainerW] = React.useState(0)
        const [frameError, setFrameError] = React.useState('')
        const [draftNote, setDraftNote] = React.useState('')
        const rootRef = React.useRef(null)
        const frameRef = React.useRef(null)
        const dragging = React.useRef(false)

        // iframe → 父：只有用户点了业务页按钮才会走到这里。父侧只写草稿，不发送。
        React.useEffect(() => {
          const onMessage = (event) => {
            const frame = frameRef.current
            const origin = window.location.origin
            // 来源不对就不认：连回执都不发（否则成了给任意页面确认的探针）。
            if (!isTrustedSource(event, frame, origin)) return
            const req = readDraftRequest(event.data)
            if (req.requestId === null) return
            const reply = (payload) => {
              try {
                frame.contentWindow.postMessage(Object.assign({ type: DRAFT_RESULT, requestId: req.requestId }, payload), origin)
              } catch { /* iframe 已销毁，放弃回执 */ }
            }
            if (!req.ok) { reply({ ok: false, error: req.error }); return }
            // 异步：没有会话时先向宿主申请一个（只在这一刻、只因用户点了按钮）。
            void (async () => {
              const service = bridge && typeof bridge.get === 'function' ? bridge.get('desktopWorkbenches') : null
              let id = typeof service?.currentSession === 'function' ? service.currentSession() : null
              if (!id) {
                if (typeof service?.ensureSession !== 'function') throw new Error('还没有本工作台的会话，先打开一次 AI 对话再试')
                id = await service.ensureSession({ folder: null })
                if (!id) throw new Error('宿主没能创建会话')
              }
              return writeDraft(bridge, req.prompt, id)
            })().then((result) => {
              reply({ ok: true, appended: result.appended })
              setDraftNote(result.appended ? '已接到会话草稿末尾，按回车发送' : '已填入会话草稿，按回车发送')
              setOpen(true)
            }).catch((error) => {
              const message = String(error && error.message ? error.message : error)
              reply({ ok: false, error: message })
              setDraftNote('没能写进会话草稿：' + message)
            })
          }
          window.addEventListener('message', onMessage)
          return () => window.removeEventListener('message', onMessage)
        }, [])

        React.useEffect(() => {
          const el = rootRef.current
          if (!el || typeof ResizeObserver === 'undefined') return
          const ro = new ResizeObserver((entries) => setContainerW(entries[0].contentRect.width))
          ro.observe(el)
          return () => ro.disconnect()
        }, [])

        React.useEffect(() => {
          const move = (e) => {
            if (!dragging.current || !rootRef.current) return
            const rect = rootRef.current.getBoundingClientRect()
            setWidth(clamp(((rect.right - e.clientX) / rect.width) * 100))
          }
          const up = () => { if (dragging.current) { dragging.current = false; saveWidth(width) } }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
          return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
        }, [width])

        const drawer = containerW > 0 && containerW < PANE.drawerBelowPx
        const conversation = props && props.conversation ? props.conversation : null
        const paneStyle = drawer
          ? { position: 'absolute', inset: 0, width: '100%', zIndex: 5 }
          : { width: width + '%' }

        const onKeyDown = (e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setWidth((w) => { const n = clamp(w + PANE.step); saveWidth(n); return n }) }
          if (e.key === 'ArrowRight') { e.preventDefault(); setWidth((w) => { const n = clamp(w - PANE.step); saveWidth(n); return n }) }
          if (e.key === 'Home') { e.preventDefault(); setWidth(PANE.max); saveWidth(PANE.max) }
          if (e.key === 'End') { e.preventDefault(); setWidth(PANE.min); saveWidth(PANE.min) }
        }

        return h('div', {
          ref: rootRef,
          className: 'wb-ferropal',
          style: {
            display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%',
            position: drawer ? 'relative' : undefined, background: 'var(--wb-paper, #f4f7f2)',
          },
        },
          h('header', {
            style: {
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
              paddingInlineStart: 'calc(14px + var(--dsh-frame-leading-clearance, 0px))',
              borderBottom: '1px solid var(--wb-line, #d9e4d9)', background: 'var(--wb-surface, #fff)', flex: '0 0 auto',
            },
          },
            h('strong', { style: { fontSize: 14 } }, metadata.title),
            h('span', { style: { color: '#5c6f64', fontSize: 12 } }, 'v' + VERSION),
            h('span', { style: { flex: 1 } }),
            h('button', {
              type: 'button',
              'aria-expanded': open,
              onClick: () => setOpen((v) => !v),
              style: { borderRadius: 999, border: '1px solid #d9e4d9', background: open ? '#e3f1e7' : '#fff', padding: '4px 12px', cursor: 'pointer' },
            }, open ? '收起 AI 对话' : '打开 AI 对话'),
          ),
          h('div', { style: { display: 'flex', flex: 1, minHeight: 0, position: 'relative' } },
            h('div', { style: { flex: 1, minWidth: 0, display: 'flex' } },
              h('iframe', {
                ref: frameRef,
                title: metadata.title + ' 业务区',
                src: UI_ENTRY,
                style: { border: 0, width: '100%', height: '100%', background: '#f4f7f2' },
                onError: () => setFrameError('页面没能加载：Harness 刚重启或插件还没加载完'),
              }),
            ),
            h(React.Fragment, null,
                  h('div', {
                    role: 'separator', 'aria-orientation': 'vertical', tabIndex: 0,
                    'aria-label': '拖动调整 AI 面板宽度', 'aria-valuemin': PANE.min, 'aria-valuemax': PANE.max, 'aria-valuenow': width,
                    onPointerDown: () => { dragging.current = true },
                    onKeyDown,
                    style: { flex: '0 0 6px', display: open ? 'block' : 'none', cursor: 'col-resize', background: '#d9e4d9' },
                  }),
                  h('aside', {
                    'aria-label': 'AI 对话面板',
                    style: Object.assign({
                      flex: drawer ? undefined : '0 0 auto', minWidth: 0, display: open ? 'flex' : 'none', flexDirection: 'column',
                      borderInlineStart: drawer ? 0 : '1px solid #d9e4d9', background: '#fff',
                    }, paneStyle),
                  },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #d9e4d9' } },
                      h('b', { style: { fontSize: 13 } }, 'AI 对话'),
                      h('span', { style: { color: '#5c6f64', fontSize: 11 } }, conversation ? '已连接宿主会话' : '本机模式 · 未创建会话'),
                      h('span', { style: { flex: 1 } }),
                      h('button', { type: 'button', 'aria-label': '收起 AI 面板', onClick: () => setOpen(false), style: { border: 0, background: 'transparent', fontSize: 16, cursor: 'pointer' } }, '×'),
                    ),
                    draftNote ? h('p', { 'aria-live': 'polite', style: { margin: '6px 10px 0', color: '#5c6f64', fontSize: 11, lineHeight: 1.6 } }, draftNote) : null,
                    h('div', { style: { flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 } },
                      conversation
                        ? h('div', { style: { minHeight: 0 } }, conversation)
                        : h('p', { style: { color: '#5c6f64', fontSize: 12, lineHeight: 1.7 } },
                            '业务区照常可用。当前未核实宿主会话创建能力；此按钮只展开面板，不代表会话已创建，也不会自动发送内容。',
                            frameError ? h('br', null) : null,
                            frameError ? h('span', { style: { color: '#8d3a3f' } }, frameError) : null),
                    ),
                  ),
                ),
          ),
          h('footer', {
            style: { flex: '0 0 auto', borderTop: '1px solid var(--wb-line, #d9e4d9)', padding: '6px 14px', color: '#5c6f64', fontSize: 11, display: 'flex', gap: 8 },
          }, h('span', null, '小铁宝 FerroPal'), h('span', { style: { flex: 1 } }), h('span', null, 'v' + VERSION + ' · ' + BUILD)),
        )
      }

      function apply(ctx) {
        bridge = ctx
        ctx.effect(() => ctx.desktopWorkbenches.register({
          title: metadata.title,
          repository: "https://github.com/xyb-openharness-dsh-plugins/thalassemia-workbench",
          description: metadata.description,
          customFrame: true,
          layout: { businessSide: 'left', businessWidth: 0.65 },
        }, Panel))
      }

      // 只声明 desktopWorkbenches：'sessions' 用 ctx.get() 读。
      // 写进 inject 会让没有该服务的宿主整包停在 INACTIVE（cordis src/fiber.ts 的 _refresh）。
      return { apply, inject: ['desktopWorkbenches'] }
    },
  })
})()
