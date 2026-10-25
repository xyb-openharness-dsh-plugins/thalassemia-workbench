import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// 上下文：customFrame 宿主节点不能随面板开关卸载。用同一个 conversation 对象，
// 直接检查真实客户端函数返回的 React 元素树；不以源码含“始终挂载”注释作证据。
test('关闭和打开面板均保留同一原生 conversation 节点，只切换 display', () => {
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let open = false
  let Panel
  let hookIndex = 0
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const i = hookIndex++
      return [i === 1 ? open : typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useRef: () => ({ current: null }),
    useEffect() {},
  }
  const window = { localStorage: { getItem: () => null }, __ModuleLoader__: {
    load(descriptor) {
      const plugin = descriptor.factory((name) => { assert.equal(name, 'react'); return React })
      plugin.apply({ effect: (f) => f(), desktopWorkbenches: { register: (_, component) => { Panel = component } } })
    },
  } }
  runInNewContext(code, { window })
  assert.equal(typeof Panel, 'function')
  const conversation = { nativeConversation: true }
  function visit(tree, predicate, hits = []) {
    if (tree === conversation || (tree && typeof tree === 'object' && !Array.isArray(tree))) {
      if (predicate(tree)) hits.push(tree)
      for (const child of tree.children || []) visit(child, predicate, hits)
    } else if (Array.isArray(tree)) for (const child of tree) visit(child, predicate, hits)
    return hits
  }
  for (const visible of [false, true, false]) {
    open = visible; hookIndex = 0
    const tree = Panel({ conversation })
    assert.equal(visit(tree, (node) => node === conversation).length, 1)
    const aside = visit(tree, (node) => node.type === 'aside')
    assert.equal(aside.length, 1)
    assert.equal(aside[0].props.style.display, visible ? 'flex' : 'none')
    assert.equal(tree.children[0].type, 'header')
  }
})
