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
 */
;(function () {
  if (typeof window === 'undefined' || typeof window.__ModuleLoader__?.load !== 'function') return

  window.__ModuleLoader__.load({
    id: "@ferropal-dsh/thalassemia-workbench",
    factory(require) {
      const React = require('react')
      const h = React.createElement
      const metadata = { title: "小铁宝 FerroPal · 重型地中海贫血工作台", description: "本机优先的重型地中海贫血（输血依赖型）输血—去铁循环、血清铁蛋白与生长发育随访、遗传与生育咨询准备工作台" }
      const VERSION = "0.3.1"
      const BUILD = "2026-10-25"
      const API_PREFIX = "/api/ferropal-workbench"
      const UI_ENTRY = "/api/ferropal-workbench/ui/"
      const PANE = {"min":25,"max":45,"default":35,"step":2,"drawerBelowPx":760}
      const STORE_KEY = 'ferropal.agent.width'

      const clamp = (n) => Math.min(PANE.max, Math.max(PANE.min, Math.round(Number(n) || PANE.default)))

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
        const rootRef = React.useRef(null)
        const dragging = React.useRef(false)

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
                title: metadata.title + ' 业务区',
                src: UI_ENTRY,
                style: { border: 0, width: '100%', height: '100%', background: '#f4f7f2' },
                onError: () => setFrameError('页面没能加载：Harness 刚重启或插件还没加载完'),
              }),
            ),
            open
              ? h(React.Fragment, null,
                  h('div', {
                    role: 'separator', 'aria-orientation': 'vertical', tabIndex: 0,
                    'aria-label': '拖动调整 AI 面板宽度', 'aria-valuemin': PANE.min, 'aria-valuemax': PANE.max, 'aria-valuenow': width,
                    onPointerDown: () => { dragging.current = true },
                    onKeyDown,
                    style: { flex: '0 0 6px', cursor: 'col-resize', background: '#d9e4d9' },
                  }),
                  h('aside', {
                    'aria-label': 'AI 对话面板',
                    style: Object.assign({
                      flex: drawer ? undefined : '0 0 auto', minWidth: 0, display: 'flex', flexDirection: 'column',
                      borderInlineStart: drawer ? 0 : '1px solid #d9e4d9', background: '#fff',
                    }, paneStyle),
                  },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #d9e4d9' } },
                      h('b', { style: { fontSize: 13 } }, 'AI 对话'),
                      h('span', { style: { color: '#5c6f64', fontSize: 11 } }, conversation ? '已连接宿主会话' : '本机模式 · 未创建会话'),
                      h('span', { style: { flex: 1 } }),
                      h('button', { type: 'button', 'aria-label': '收起 AI 面板', onClick: () => setOpen(false), style: { border: 0, background: 'transparent', fontSize: 16, cursor: 'pointer' } }, '×'),
                    ),
                    h('div', { style: { flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 } },
                      conversation
                        ? h('div', { style: { minHeight: 0 } }, conversation)
                        : h('p', { style: { color: '#5c6f64', fontSize: 12, lineHeight: 1.7 } },
                            '业务区照常可用。需要 AI 协助时，点顶栏按钮创建会话；我不替你发送、也不替医生判断。',
                            frameError ? h('br', null) : null,
                            frameError ? h('span', { style: { color: '#8d3a3f' } }, frameError) : null),
                    ),
                  ),
                )
              : null,
          ),
          h('footer', {
            style: { flex: '0 0 auto', borderTop: '1px solid var(--wb-line, #d9e4d9)', padding: '6px 14px', color: '#5c6f64', fontSize: 11, display: 'flex', gap: 8 },
          }, h('span', null, '小铁宝 FerroPal'), h('span', { style: { flex: 1 } }), h('span', null, 'v' + VERSION + ' · ' + BUILD)),
        )
      }

      function apply(ctx) {
        ctx.effect(() => ctx.desktopWorkbenches.register({
          title: metadata.title,
          repository: "https://github.com/xyb-openharness-dsh-plugins/thalassemia-workbench",
          description: metadata.description,
          customFrame: true,
          layout: { businessSide: 'left', businessWidth: 0.65 },
        }, Panel))
      }

      return { apply, inject: ['desktopWorkbenches'] }
    },
  })
})()
