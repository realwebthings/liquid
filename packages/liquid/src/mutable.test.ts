import { describe, expect, it, vi } from 'vitest'
import { mutate, produce } from './mutable'
import { createStore } from './vanilla'

const base = () => ({
  count: 0,
  user: { name: 'a', tags: ['x', 'y'] },
  other: { n: 1 },
  list: [{ id: 1 }, { id: 2 }],
})

describe('produce', () => {
  it('returns the same reference when nothing written', () => {
    const b = base()
    expect(produce(b, (d) => void d.count)).toBe(b)
    expect(produce(b, (d) => { d.count = 0 })).not.toBe(b) // a write is a write
  })

  it('writes a primitive, leaves base untouched', () => {
    const b = base()
    const n = produce(b, (d) => { d.count++ })
    expect(n.count).toBe(1)
    expect(b.count).toBe(0)
  })

  it('copies only the path written; siblings keep their reference', () => {
    const b = base()
    const n = produce(b, (d) => { d.user.name = 'z' })
    expect(n.user.name).toBe('z')
    expect(b.user.name).toBe('a')
    expect(n.user).not.toBe(b.user)
    expect(n.other).toBe(b.other)
    expect(n.user.tags).toBe(b.user.tags)
  })

  it('array push, pop, splice, index write', () => {
    const b = base()
    const n = produce(b, (d) => {
      d.user.tags.push('w')
      d.list[0]!.id = 9
      d.list.splice(1, 1)
    })
    expect(n.user.tags).toEqual(['x', 'y', 'w'])
    expect(n.list).toEqual([{ id: 9 }])
    expect(b.user.tags).toEqual(['x', 'y'])
    expect(b.list).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('delete, in, Object.keys, spread, JSON', () => {
    const b = base()
    let seen: unknown
    const n = produce(b, (d) => {
      delete (d as any).other
      seen = [
        'other' in d,
        Object.keys(d).sort(),
        JSON.stringify(d.user),
        Array.isArray(d.list),
      ]
    })
    expect('other' in n).toBe(false)
    expect(seen).toEqual([false, ['count', 'list', 'user'], '{"name":"a","tags":["x","y"]}', true])
  })

  it('writing the same path twice and reading back inside recipe', () => {
    const n = produce(base(), (d) => {
      d.user.name = 'p'
      d.user.name += 'q'
      expect(d.user.name).toBe('pq')
    })
    expect(n.user.name).toBe('pq')
  })

  it('assigning a whole new object then mutating it', () => {
    const n = produce(base(), (d) => {
      d.user = { name: 'new', tags: [] }
      d.user.tags.push('t')
    })
    expect(n.user).toEqual({ name: 'new', tags: ['t'] })
  })

  it('non-plain values (Date) are opaque, not proxied', () => {
    const date = new Date(0)
    const n = produce({ d: date, k: 1 }, (x) => { x.k = 2 })
    expect(n.d).toBe(date)
  })

  it('functions in state stay callable', () => {
    const fn = vi.fn()
    const n = produce({ fn, c: 0 }, (d) => { d.c++; d.fn() })
    expect(fn).toHaveBeenCalled()
    expect(n.fn).toBe(fn)
  })
})

describe('produce: drafts never escape into state', () => {
  it('assigning a draft stores plain data, not a live proxy', () => {
    const b = base()
    const n = produce(b, (d) => {
      d.user.name = 'z'
      ;(d as any).copyOfUser = d.user
    })
    expect((n as any).copyOfUser).toBe(n.user) // finalized object, identical to the real one
    // still plain after the recipe: writing through it later cannot touch the state
    expect(Object.getOwnPropertyDescriptor(n.user, 'name')?.value).toBe('z')
  })

  it('assigning an untouched draft keeps the original reference', () => {
    const b = base()
    const n = produce(b, (d) => { (d as any).alias = d.other })
    expect((n as any).alias).toBe(b.other)
  })

  it('pushing a draft into an array stores plain data', () => {
    const b = base()
    const n = produce(b, (d) => { d.list.push(d.list[0]!) })
    expect(n.list[2]).toBe(b.list[0])
  })
})

describe('mutate(store)', () => {
  it('updates store and notifies once', () => {
    const store = createStore(() => base())
    const l = vi.fn()
    store.subscribe(l)
    mutate(store, (d) => { d.user.name = 'z'; d.count++ })
    expect(store.getState().user.name).toBe('z')
    expect(l).toHaveBeenCalledTimes(1)
  })

  it('no write means no notify', () => {
    const store = createStore(() => base())
    const l = vi.fn()
    store.subscribe(l)
    mutate(store, () => {})
    expect(l).not.toHaveBeenCalled()
  })

  it('previous state is untouched (selectors can compare)', () => {
    const store = createStore(() => base())
    const prevOther = store.getState().other
    const prevUser = store.getState().user
    mutate(store, (d) => { d.user.name = 'z' })
    expect(store.getState().other).toBe(prevOther)
    expect(store.getState().user).not.toBe(prevUser)
  })
})
