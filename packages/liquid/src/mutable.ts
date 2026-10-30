import type { Store } from './vanilla'

// Copy-on-write drafts: write `d.a.b = 1` or `d.list.push(x)` and get a new
// immutable state. Only the objects on the written path are copied.
type Node = {
  base: any
  copy?: any
  parent?: Node
  key?: PropertyKey
  kids: Map<PropertyKey, any>
}

const draftable = (v: unknown): v is object =>
  v !== null &&
  typeof v === 'object' &&
  (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)

const src = (n: Node) => n.copy ?? n.base

// proxy -> node, so a draft assigned somewhere else is stored as plain data, never as a live proxy
const drafts = new WeakMap<object, Node>()

// Copy this node, and every ancestor, the first time something is written.
const touch = (n: Node) => {
  if (n.copy) return
  n.copy = Array.isArray(n.base) ? n.base.slice() : { ...n.base }
  if (n.parent) {
    touch(n.parent)
    n.parent.copy[n.key!] = n.copy
  }
}

// Arrays need an array target so Array.isArray(draft) stays true.
const nodeOf = (target: any): Node => (Array.isArray(target) ? target[0] : target)

const handler: ProxyHandler<any> = {
  get(t, key) {
    const n = nodeOf(t)
    const value = Reflect.get(src(n), key)
    if (!draftable(value)) return value
    let kid = n.kids.get(key)
    if (!kid) n.kids.set(key, (kid = wrap(value, n, key).proxy))
    return kid
  },
  set(t, key, value) {
    const n = nodeOf(t)
    touch(n)
    n.kids.delete(key)
    const d = drafts.get(value)
    return Reflect.set(n.copy, key, d ? src(d) : value)
  },
  deleteProperty(t, key) {
    const n = nodeOf(t)
    touch(n)
    n.kids.delete(key)
    return Reflect.deleteProperty(n.copy, key)
  },
  has: (t, key) => Reflect.has(src(nodeOf(t)), key),
  ownKeys: (t) => Reflect.ownKeys(src(nodeOf(t))),
  getOwnPropertyDescriptor: (t, key) =>
    Reflect.getOwnPropertyDescriptor(src(nodeOf(t)), key),
}

const wrap = (base: object, parent?: Node, key?: PropertyKey) => {
  const node: Node = { base, parent, key, kids: new Map() }
  const proxy = new Proxy(Array.isArray(base) ? [node] : node, handler)
  drafts.set(proxy, node)
  return { node, proxy }
}

export function produce<T extends object>(base: T, recipe: (draft: T) => void): T {
  const { node, proxy } = wrap(base)
  recipe(proxy as T)
  return node.copy ?? base // unchanged: same reference, so no notify
}

export const mutate = <T extends object>(
  store: Pick<Store<T>, 'setState'>,
  recipe: (draft: T) => void,
) => store.setState((state) => produce(state, recipe))
