import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

/* 上下文：业务页 iframe 要把「带着这段去问 AI」的提示词送进宿主原生会话草稿。
 * 这条链路只要有一环失败（没有会话 / 服务没提供 / 草稿里有引用），父侧必须回 ok:false，
 * 不许回报成功 —— 否则用户会在界面上看到"已接通"，而会话输入框其实是空的。
 *
 * 这里跑的是 lib/client.js 里的**真实 factory**，只把 React / window / ctx 换成最小假件，
 * 断言的是真实函数的返回值与真实 frame.postMessage 的内容，不看源码里有没有某句话。
 */

const ORIGIN = 'app://dsh'

/** 装一个最小 React：useState 有真状态，useEffect 被收集起来手动跑。 */
function makeReact() {
  const effects = []
  const states = []
  let hookIndex = 0
  return {
    effects,
    resetHooks() { hookIndex = 0 },
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const i = hookIndex++
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
      return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next }]
    },
    useRef: () => ({ current: null }),
    useEffect(fn) { effects.push(fn) },
  }
}

/**
 * 造一个宿主：apply 真的执行（bridge 被写上），register 捕获 Panel，
 * 跑完 effects 后拿到真实的 message 监听器。
 */
function makeHost(deps = {}) {
  const React = makeReact()
  const listeners = {}
  const notifications = []
  const frameWindow = {
    postMessage: (data, target) => notifications.push({ data, target }),
  }
  let Panel = null
  const services = {}
  const ctx = {
    effect: (fn) => fn(),
    get: (name) => services[name],
    desktopWorkbenches: {
      register: (_meta, component) => { Panel = component; return () => {} },
    },
  }
  if ('desktopWorkbenches' in deps) services.desktopWorkbenches = deps.desktopWorkbenches
  else services.desktopWorkbenches = { currentSession: () => deps.sessionId || null }
  if ('sessions' in deps) services.sessions = deps.sessions

  const window = {
    location: { origin: ORIGIN },
    localStorage: { getItem: () => null, setItem: () => {} },
    addEventListener: (name, fn) => { listeners[name] = fn },
    removeEventListener: (name) => { delete listeners[name] },
    __ModuleLoader__: {
      load(descriptor) {
        const plugin = descriptor.factory((name) => {
          assert.equal(name, 'react')
          return React
        })
        plugin.apply(ctx)
      },
    },
  }
  runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window })
  assert.equal(typeof Panel, 'function', 'apply 必须注册业务面板')

  React.resetHooks()
  const tree = Panel({ conversation: deps.conversation || null })
  // 跑所有 effect：其中会真的 window.addEventListener('message', ...)。
  for (const fn of React.effects) {
    try { fn() } catch { /* ResizeObserver / pointer 监听在假 window 里可能不可用，与本测试无关 */ }
  }
  // 让 iframe 的 ref 指向真 frame 窗口（真 React 在挂载时做这件事）。
  const ref = findIframeRef(tree)
  if (ref) ref.current = { contentWindow: frameWindow }
  assert.equal(typeof listeners.message, 'function', '必须注册 message 监听')
  // 投递一条消息并等父侧异步链走完（没有会话时要先向宿主申请会话）。
  const send = async (event) => {
    listeners.message(event)
    for (let i = 0; i < 20; i++) await Promise.resolve()
  }
  return { send, onMessage: listeners.message, frameWindow, notifications, Panel }
}

function findIframeRef(tree) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === 'iframe') return tree.props.ref || null
  for (const child of tree.children || []) {
    const hit = findIframeRef(child)
    if (hit) return hit
  }
  return null
}

function event(frameWindow, data, overrides = {}) {
  return Object.assign({ source: frameWindow, origin: ORIGIN, data }, overrides)
}

/** 一个可用的会话服务：scope → ctx.get('conversation') → input.for() → setDraft。 */
function workingSessions(snapshot = { draft: '', occurrences: [], phase: 'plain' }) {
  const written = []
  // 真实形状：conversation.input.for(actx) 返回 shell，shell 上才有 state/setDraft。
  const shell = {
    state: { getSnapshot: () => snapshot },
    setDraft: (text) => written.push(text),
  }
  const conversation = { input: { for: () => shell } }
  return {
    written,
    sessions: {
      scope: () => ({ get: (name) => (name === 'conversation' ? conversation : undefined) }),
    },
  }
}

test('普通草稿是追加（保留用户已有内容），不是覆盖', async () => {
  const { sessions, written } = workingSessions({ draft: '我本来写了一半', occurrences: [], phase: 'plain' })
  const host = makeHost({ sessionId: 's-1', sessions })
  await host.send(event(host.frameWindow, {
    type: 'ferropal:agent-draft', requestId: 'r-1', prompt: '帮我把这三个月的变化整理一下',
  }))
  assert.deepEqual(written, ['我本来写了一半\n\n帮我把这三个月的变化整理一下'])
  assert.equal(host.notifications.length, 1)
  assert.equal(host.notifications[0].data.ok, true)
  assert.equal(host.notifications[0].data.appended, true)
  assert.equal(host.notifications[0].data.requestId, 'r-1')
  // 宿主只写草稿，绝不代发。
  assert.equal(host.notifications[0].data.sent, undefined)
})

test('空草稿时直接填入，不留下前导空行', async () => {
  const { sessions, written } = workingSessions({ draft: '   ', occurrences: [], phase: 'plain' })
  const host = makeHost({ sessionId: 's-1', sessions })
  await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-2', prompt: '看这条' }))
  assert.deepEqual(written, ['看这条'])
})

test('草稿里有引用/特殊输入时拒写，且回 ok:false 不谎报', async () => {
  for (const snapshot of [
    { draft: 'x', occurrences: [{ ref: 1 }], phase: 'plain' },
    { draft: 'x', occurrences: [], phase: 'reference' },
  ]) {
    const { sessions, written } = workingSessions(snapshot)
    const host = makeHost({ sessionId: 's-1', sessions })
    await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-3', prompt: '看这条' }))
    assert.equal(written.length, 0, '有引用时不许动用户草稿')
    assert.equal(host.notifications.length, 1)
    assert.equal(host.notifications[0].data.ok, false)
    assert.match(host.notifications[0].data.error, /引用|特殊输入/)
  }
})

test('来源不是自己的 iframe、或不同源：不写、连回执都不发', async () => {
  const { sessions, written } = workingSessions()
  const host = makeHost({ sessionId: 's-1', sessions })
  const payload = { type: 'ferropal:agent-draft', requestId: 'r-4', prompt: '恶意注入' }

  // 别的窗口（不是本 iframe）
  await host.send(event(host.frameWindow, payload, { source: { evil: true } }))
  // 同 iframe 但跨源
  await host.send(event(host.frameWindow, payload, { origin: 'https://evil.example' }))
  // 消息里没类型 / 类型不是我们的
  await host.send(event(host.frameWindow, { requestId: 'r-4', prompt: 'x' }))
  await host.send(event(host.frameWindow, { type: 'other:thing', requestId: 'r-4', prompt: 'x' }))

  assert.equal(written.length, 0)
  assert.equal(host.notifications.length, 0, '不可信来源不得有任何回执（否则成了探测口）')
})

test('prompt 类型/长度/空值都要挡住', async () => {
  const { sessions, written } = workingSessions()
  const host = makeHost({ sessionId: 's-1', sessions })
  const bad = [
    { requestId: 'r-5', prompt: 12345 },
    { requestId: 'r-5', prompt: '   ' },
    { requestId: 'r-5', prompt: 'x'.repeat(4001) },
    { requestId: 'bad id with spaces!', prompt: '正常' },
    { prompt: '没有 requestId' },
  ]
  for (const item of bad) {
    await host.send(event(host.frameWindow, Object.assign({ type: 'ferropal:agent-draft' }, item)))
  }
  assert.equal(written.length, 0)
  // 有合法 requestId 的坏 payload 要回执告诉界面失败；连 requestId 都不合法的直接丢。
  const replied = host.notifications.filter((n) => n.data.ok === false)
  assert.ok(replied.length >= 3, '带 requestId 的非法请求必须回 ok:false')
  assert.ok(host.notifications.every((n) => n.data.type === 'ferropal:agent-draft-result'))
  assert.ok(host.notifications.every((n) => n.target === ORIGIN), '回执必须发往本页同源')
})

test('挂载时不建会话；点了按钮才建，建失败回 ok:false', async () => {
  const { sessions, written } = workingSessions()
  const ensureCalls = []
  const host = makeHost({
    sessions,
    desktopWorkbenches: {
      currentSession: () => null,
      ensureSession: (opts) => { ensureCalls.push(opts); return Promise.reject(new Error('宿主拒绝创建会话')) },
    },
  })
  // 挂载后（effects 已跑完）不得有任何建会话动作。
  assert.equal(ensureCalls.length, 0, '首次进页面不得自动建会话')
  await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-6', prompt: '看这条' }))
  assert.equal(ensureCalls.length, 1, '用户点了按钮才允许申请会话')
  assert.equal(written.length, 0)
  assert.equal(host.notifications[0].data.ok, false)
  assert.match(host.notifications[0].data.error, /宿主拒绝创建会话/)
})

test('会话申请成功后写入草稿（不要求用户先手动打开 AI 面板）', async () => {
  const { sessions, written } = workingSessions({ draft: '', occurrences: [], phase: 'plain' })
  let created = null
  const host = makeHost({
    sessions,
    desktopWorkbenches: {
      currentSession: () => created,
      ensureSession: () => { created = 's-new'; return Promise.resolve('s-new') },
    },
  })
  await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-11', prompt: '看这条' }))
  assert.deepEqual(written, ['看这条'])
  assert.equal(host.notifications[0].data.ok, true)
})

test('宿主没提供 sessions 服务：回 ok:false，明确说未接通', async () => {
  const written = []
  const host = makeHost({ sessionId: 's-1', sessions: undefined })
  await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-7', prompt: '看这条' }))
  assert.equal(written.length, 0)
  assert.equal(host.notifications.length, 1)
  assert.equal(host.notifications[0].data.ok, false)
  assert.match(host.notifications[0].data.error, /会话服务|sessions/)
})

test('会话不属于本工作台时不写（宿主提供 ownsSession 时才校验）', async () => {
  const { sessions, written } = workingSessions()
  const host = makeHost({
    sessions,
    desktopWorkbenches: { currentSession: () => 's-9', ownsSession: () => false },
  })
  await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-8', prompt: '看这条' }))
  assert.equal(written.length, 0)
  assert.equal(host.notifications[0].data.ok, false)
  assert.match(host.notifications[0].data.error, /不属于本工作台/)
})

test('scope 取不到（会话未就绪）：回 ok:false', async () => {
  const { written } = workingSessions()
  const host = makeHost({ sessionId: 's-1', sessions: { scope: () => undefined } })
  await host.send(event(host.frameWindow, { type: 'ferropal:agent-draft', requestId: 'r-9', prompt: '看这条' }))
  assert.equal(written.length, 0)
  assert.equal(host.notifications[0].data.ok, false)
  assert.match(host.notifications[0].data.error, /尚未就绪|scope/)
})

test('sessions 没有写进 inject，避免无该服务的宿主整包不加载', async () => {
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const m = code.match(/return\s*\{\s*apply\s*,\s*inject:\s*\[([^\]]*)\]/)
  assert.ok(m, '必须能读到 inject 声明')
  const names = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  assert.deepEqual(names, ['desktopWorkbenches'])
  assert.ok(!names.includes('sessions'), 'sessions 必须走 ctx.get()，不能进 inject')
})
