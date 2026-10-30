import { act, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { create } from './create'
import { createStoreContext } from './context'
import { crossTab } from './cross-tab'
import { getPersist, persist, type SyncStorageLike as StorageLike } from './persist'
import { createStore } from './vanilla'

const memory = (seed: Record<string, string> = {}) => {
  const data = { ...seed }
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
  }
  return { data, storage }
}
const tick = () => new Promise<void>((r) => queueMicrotask(r))

type S = { count: number; temp: string; inc: () => void }
const base = (set: (p: Partial<S> | ((s: S) => Partial<S>)) => void): S => ({
  count: 0,
  temp: 't',
  inc: () => set((s) => ({ count: s.count + 1 })),
})

describe('persist', () => {
  it('writes to storage on set, without functions', async () => {
    const { data, storage } = memory()
    const store = createStore<S>(persist(base, { name: 'k', storage }))
    await tick()
    store.getState().inc()
    expect(JSON.parse(data.k!).state).toEqual({ count: 1, temp: 't' })
  })

  it('external setState is saved too', async () => {
    const { data, storage } = memory()
    const store = createStore<S>(persist(base, { name: 'k', storage }))
    await tick()
    store.setState({ count: 3 })
    expect(JSON.parse(data.k!).state.count).toBe(3)
  })

  it('partialize picks what is saved', async () => {
    const { data, storage } = memory()
    const store = createStore<S>(
      persist(base, { name: 'k', storage, partialize: (s) => ({ count: s.count }) }),
    )
    await tick()
    store.setState({ count: 2, temp: 'x' })
    expect(JSON.parse(data.k!).state).toEqual({ count: 2 })
  })

  it('rehydrates after creation, keeps actions', async () => {
    const { storage } = memory({ k: '{"state":{"count":7},"version":0}' })
    const store = createStore<S>(persist(base, { name: 'k', storage }))
    expect(store.getState().count).toBe(0) // not synchronous
    await tick()
    expect(store.getState().count).toBe(7)
    store.getState().inc()
    expect(store.getState().count).toBe(8)
  })

  it('getInitialState stays pre-persist (SSR-safe)', async () => {
    const { storage } = memory({ k: '{"state":{"count":7},"version":0}' })
    const store = createStore<S>(persist(base, { name: 'k', storage }))
    await tick()
    expect(store.getInitialState().count).toBe(0)
  })

  it('does not write back on rehydrate', async () => {
    const { data, storage } = memory({ k: '{"state":{"count":7},"version":0}' })
    createStore<S>(persist(base, { name: 'k', storage }))
    await tick()
    expect(data.k).toBe('{"state":{"count":7},"version":0}')
  })

  it('ignores corrupt JSON and throwing storage', async () => {
    const bad = memory({ k: '{nope' })
    const s1 = createStore<S>(persist(base, { name: 'k', storage: bad.storage }))
    await tick()
    expect(s1.getState().count).toBe(0)

    const boom: StorageLike = {
      getItem: () => { throw new Error('x') },
      setItem: () => { throw new Error('x') },
    }
    const s2 = createStore<S>(persist(base, { name: 'k', storage: boom }))
    await tick()
    expect(() => s2.getState().inc()).not.toThrow()
    expect(s2.getState().count).toBe(1)
  })

  it('no storage (SSR) is a no-op', () => {
    const store = createStore<S>(persist(base, { name: 'k', storage: undefined }))
    store.getState().inc()
    expect(store.getState().count).toBe(1)
  })
})

describe('persist v2', () => {
  const env = (state: object, version: number) => JSON.stringify({ state, version })

  it('saves the version', async () => {
    const { data, storage } = memory()
    const store = createStore<S>(persist(base, { name: 'k', storage, version: 3 }))
    await tick()
    store.setState({ count: 1 })
    expect(JSON.parse(data.k!).version).toBe(3)
  })

  it('migrates older data, then stores the new shape once', async () => {
    const { data, storage } = memory({ k: env({ n: 5 }, 1) })
    const store = createStore<S>(
      persist(base, {
        name: 'k',
        storage,
        version: 2,
        migrate: (saved, v) => (v === 1 ? { count: saved.n } : undefined),
      }),
    )
    await tick()
    expect(store.getState().count).toBe(5)
    expect(JSON.parse(data.k!)).toEqual({ state: { count: 5, temp: 't' }, version: 2 })
  })

  it('ignores older data when no migrate is given', async () => {
    const { storage } = memory({ k: env({ count: 9 }, 1) })
    const store = createStore<S>(persist(base, { name: 'k', storage, version: 2 }))
    await tick()
    expect(store.getState().count).toBe(0)
  })

  it('hasHydrated / onHydrated, even with nothing stored', async () => {
    const { storage } = memory()
    const store = createStore<S>(persist(base, { name: 'k', storage }))
    const api = getPersist(store)!
    const cb = vi.fn()
    api.onHydrated(cb)
    expect(api.hasHydrated()).toBe(false)
    await tick()
    expect(api.hasHydrated()).toBe(true)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('getPersist is undefined without persist', () => {
    expect(getPersist(createStore(() => ({})))).toBeUndefined()
  })

  it('crossTab applies another tab\'s save, without writing back', async () => {
    localStorage.clear()
    const store = createStore<S>(crossTab(persist(base, { name: 'tab' })))
    store.subscribe(() => {}) // the listener only exists while someone subscribes
    await tick()
    localStorage.setItem('tab', env({ count: 11 }, 0)) // a browser writes first, then fires the event
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'tab', newValue: env({ count: 11 }, 0), storageArea: localStorage }),
    )
    expect(store.getState().count).toBe(11)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('crossTab ignores other keys and other storages', async () => {
    const store = createStore<S>(crossTab(persist(base, { name: 'tab2' })))
    store.subscribe(() => {})
    await tick()
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'other', newValue: env({ count: 5 }, 0), storageArea: localStorage }),
    )
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'tab2', newValue: env({ count: 5 }, 0), storageArea: sessionStorage }),
    )
    expect(store.getState().count).toBe(0)
  })
})

describe('persist: no data loss', () => {
  it('a write in the same tick as creation does not clobber stored data', async () => {
    const { data, storage } = memory({ k: JSON.stringify({ state: { count: 7, temp: 'saved' }, version: 0 }) })
    const store = createStore<S>(persist(base, { name: 'k', storage }))
    store.setState({ count: 1 }) // before hydration: must not be written over 'saved'
    expect(data.k).toContain('"temp":"saved"')
    await tick()
    expect(store.getState()).toMatchObject({ count: 7, temp: 'saved' })
  })
})

describe('persist: no leaks', () => {
  const evt = (key: string, count: number) =>
    new StorageEvent('storage', { key, newValue: JSON.stringify({ state: { count }, version: 0 }), storageArea: localStorage })

  it('window listener lives only while the store has subscribers', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const calls = (spy: typeof add) => spy.mock.calls.filter((c) => c[0] === 'storage').length
    const store = createStore<S>(crossTab(persist(base, { name: 'leak' })))
    await tick()
    expect(calls(add)).toBe(0) // created, nobody listening: nothing global

    const off1 = store.subscribe(() => {})
    const off2 = store.subscribe(() => {})
    expect(calls(add)).toBe(1) // one listener, not one per subscriber
    off1()
    off1() // double unsubscribe must not unbalance the count
    expect(calls(remove)).toBe(0)
    off2()
    expect(calls(remove)).toBe(1)

    window.dispatchEvent(evt('leak', 99)) // detached: ignored
    expect(store.getState().count).toBe(0)
    add.mockRestore()
    remove.mockRestore()
  })

  it('catches up on saves missed while detached', async () => {
    localStorage.clear()
    const store = createStore<S>(crossTab(persist(base, { name: 'catch' })))
    await tick()
    const off = store.subscribe(() => {})
    off()
    localStorage.setItem('catch', JSON.stringify({ state: { count: 5 }, version: 0 }))
    store.subscribe(() => {})
    expect(store.getState().count).toBe(5)
  })

  it('a Provider-scoped persisted store leaves no listener after unmount', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const n = (spy: typeof add) => spy.mock.calls.filter((c) => c[0] === 'storage').length
    const { Provider, useStore } = createStoreContext<S>()
    function C() { useStore((s) => s.count); return null }
    const r = render(
      <Provider init={crossTab(persist(base, { name: 'prov' }))}><C /></Provider>,
    )
    await act(async () => {})
    expect(n(add)).toBeGreaterThan(0)
    r.unmount()
    expect(n(remove)).toBe(n(add))
    add.mockRestore()
    remove.mockRestore()
  })
})

describe('persist + hydration', () => {
  it('hydrates without mismatch, then shows persisted value', async () => {
    const Counter = ({ use }: { use: () => number }) => <p id="c">{use()}</p>

    const server = create<S>(persist(base, { name: 'k', storage: undefined }))
    const html = renderToString(<Counter use={() => server((s) => s.count)} />)

    const { storage } = memory({ k: '{"state":{"count":7},"version":0}' })
    const client = create<S>(persist(base, { name: 'k', storage }))
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      hydrateRoot(container, <Counter use={() => client((s) => s.count)} />)
    })
    expect(errors).not.toHaveBeenCalled()
    expect(container.querySelector('#c')!.textContent).toBe('7')
    errors.mockRestore()
  })
})
