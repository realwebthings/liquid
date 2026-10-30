import { describe, expect, it, vi } from 'vitest'
import { getPersistAsync, persistAsync, type AsyncStorageLike } from './persist-async'
import { createStore } from './vanilla'

type S = { count: number; temp: string }
const base = (): S => ({ count: 0, temp: 't' })
const wait = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms))

// async storage with controllable latency per call
const fake = (seed: Record<string, string> = {}, delay = () => 0) => {
  const data = { ...seed }
  const log: string[] = []
  const storage: AsyncStorageLike = {
    getItem: async (k) => (await wait(delay()), data[k] ?? null),
    setItem: async (k, v) => (await wait(delay()), void (data[k] = v), void log.push(v)),
  }
  return { data, log, storage }
}
const env = (state: object, version = 0) => JSON.stringify({ state, version })

describe('persistAsync', () => {
  it('hydrates after the read resolves, not before', async () => {
    const { storage } = fake({ k: env({ count: 7 }) }, () => 5)
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    const api = getPersistAsync(store)!
    expect(api.hasHydrated()).toBe(false)
    expect(store.getState().count).toBe(0)
    await wait(20)
    expect(api.hasHydrated()).toBe(true)
    expect(store.getState().count).toBe(7)
  })

  it('getInitialState stays pre-persist (SSR-safe)', async () => {
    const { storage } = fake({ k: env({ count: 7 }) })
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    await wait(10)
    expect(store.getInitialState().count).toBe(0)
  })

  it('writes after hydration; flush waits for them', async () => {
    const { data, storage } = fake({}, () => 3)
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    await wait(10)
    store.setState({ count: 4 })
    expect(data.k).toBeUndefined() // not yet: the write is async
    await getPersistAsync(store)!.flush()
    expect(JSON.parse(data.k!)).toEqual({ state: { count: 4, temp: 't' }, version: 0 })
  })

  it('does not clobber stored data with defaults before the first read finishes', async () => {
    const { data, storage } = fake({ k: env({ count: 7, temp: 'saved' }) }, () => 10)
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    store.setState({ count: 1 }) // read still pending
    await wait(40)
    await getPersistAsync(store)!.flush()
    expect(JSON.parse(data.k!).state).toEqual({ count: 7, temp: 'saved' }) // never overwritten
    expect(store.getState()).toMatchObject({ count: 7, temp: 'saved' })
  })

  it('slow older write can never land after a newer one; bursts coalesce', async () => {
    let n = 0
    const { data, log, storage } = fake({}, () => (n++ === 1 ? 30 : 1)) // second call (first write) is slow
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    await wait(10) // hydrated
    store.setState({ count: 1 })
    store.setState({ count: 2 })
    store.setState({ count: 3 })
    await getPersistAsync(store)!.flush()
    expect(JSON.parse(data.k!).state.count).toBe(3) // newest wins
    expect(log.length).toBe(1) // three sets, one write of the latest state
  })

  it('migrates and stores the new shape', async () => {
    const { data, storage } = fake({ k: env({ n: 5 }, 1) })
    const store = createStore<S>(
      persistAsync(base, { name: 'k', storage, version: 2, migrate: (s, v) => (v === 1 ? { count: s.n } : undefined) }),
    )
    await wait(10)
    await getPersistAsync(store)!.flush()
    expect(store.getState().count).toBe(5)
    expect(JSON.parse(data.k!)).toEqual({ state: { count: 5, temp: 't' }, version: 2 })
  })

  it('onError for read and write failures; store keeps working', async () => {
    const onError = vi.fn()
    const storage: AsyncStorageLike = {
      getItem: async () => { throw new Error('read') },
      setItem: async () => { throw new Error('write') },
    }
    const store = createStore<S>(persistAsync(base, { name: 'k', storage, onError }))
    await wait(5)
    expect(onError).toHaveBeenCalledTimes(1)
    store.setState({ count: 1 })
    await getPersistAsync(store)!.flush()
    expect(onError).toHaveBeenCalledTimes(2)
    expect(store.getState().count).toBe(1)
  })

  it('corrupt data goes to onError and is ignored', async () => {
    const onError = vi.fn()
    const { storage } = fake({ k: '{nope' })
    const store = createStore<S>(persistAsync(base, { name: 'k', storage, onError }))
    await wait(5)
    expect(onError).toHaveBeenCalled()
    expect(store.getState().count).toBe(0)
    expect(getPersistAsync(store)!.hasHydrated()).toBe(true)
  })

  it('onHydrated fires once and unsubscribes', async () => {
    const { storage } = fake()
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    const api = getPersistAsync(store)!
    const cb = vi.fn()
    const off = api.onHydrated(cb)
    const never = vi.fn()
    api.onHydrated(never)()
    await wait(5)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(never).not.toHaveBeenCalled()
    off()
  })

  it('holds no global state: nothing is registered on window', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const { storage } = fake()
    const store = createStore<S>(persistAsync(base, { name: 'k', storage }))
    store.subscribe(() => {})
    await wait(5)
    expect(add).not.toHaveBeenCalled()
    add.mockRestore()
  })
})
