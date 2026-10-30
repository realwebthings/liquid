import { describe, expectTypeOf, it } from 'vitest'
import { create } from './create'
import { mutate, produce } from './mutable'
import { crossTab } from './cross-tab'
import { getPersist, persist, type PersistApi, type SyncStorageLike } from './persist'
import { getPersistAsync, persistAsync, type AsyncStorageLike, type PersistAsyncApi } from './persist-async'
import { shallow } from './shallow'
import { createStore, watch, type Store } from './vanilla'

type S = { count: number; name: string; inc: () => void }
const init = (set: (p: Partial<S>) => void): S => ({
  count: 0,
  name: 'a',
  inc: () => set({ count: 1 }),
})

// compile-time only: `tsc --noEmit` fails if any of these stop holding
describe('types', () => {
  it('create: selector result type is inferred', () => {
    const use = create<S>(init)
    // closures are never called: hooks only run inside components
    expectTypeOf(() => use((s) => s.count)).returns.toEqualTypeOf<number>()
    expectTypeOf(() => use((s) => s.name.length > 0)).returns.toEqualTypeOf<boolean>()
    expectTypeOf(() => use()).returns.toEqualTypeOf<S>()
    expectTypeOf(use.getState).returns.toEqualTypeOf<S>()
  })

  it('setState rejects unknown keys and wrong value types', () => {
    const store = createStore<S>(init)
    // @ts-expect-error unknown key
    store.setState({ nope: 1 })
    // @ts-expect-error wrong type
    store.setState({ count: 'x' })
    store.setState((s) => ({ count: s.count + 1 }))
  })

  it('persist keeps the store type', () => {
    const use = create<S>(persist(init, { name: 'x' }))
    expectTypeOf(() => use((s) => s.count)).returns.toEqualTypeOf<number>()
  })

  it('watch infers the selected type', () => {
    const store = createStore<S>(init)
    watch(store, (s) => s.count, (v, prev) => {
      expectTypeOf(v).toEqualTypeOf<number>()
      expectTypeOf(prev).toEqualTypeOf<number>()
    })
  })

  it('produce / mutate draft is the state type', () => {
    produce({ a: { b: 1 } }, (d) => {
      expectTypeOf(d.a.b).toEqualTypeOf<number>()
    })
    const store: Store<S> = createStore<S>(init)
    mutate(store, (d) => {
      d.count++
      // @ts-expect-error not a key
      d.nope = 1
    })
  })

  it('shallow compares same types', () => {
    shallow({ a: 1 }, { a: 2 })
  })
})

// sync and async persistence cannot be mixed: the compiler rejects it
describe('sync vs async segregation', () => {
  const asyncStore: AsyncStorageLike = {
    getItem: async () => null,
    setItem: async () => {},
  }
  const syncStore: SyncStorageLike = { getItem: () => null, setItem: () => {} }

  it('persist (sync) rejects async storage; persistAsync rejects sync storage', () => {
    // @ts-expect-error async storage in sync persist
    persist(init, { name: 'x', storage: asyncStore })
    // @ts-expect-error sync storage in async persist
    persistAsync(init, { name: 'x', storage: syncStore })
    // @ts-expect-error async persist needs an explicit storage
    persistAsync(init, { name: 'x' })
    persist(init, { name: 'x', storage: syncStore })
    persistAsync(init, { name: 'x', storage: asyncStore })
  })

  it('options belong to one side only', () => {
    // @ts-expect-error crossTab was never an option: it is a separate wrapper
    persistAsync(init, { name: 'x', storage: asyncStore, crossTab: true })
    // @ts-expect-error onError is async-only
    persist(init, { name: 'x', onError: () => {} })
  })

  it('crossTab wraps only a sync persist', () => {
    crossTab(persist(init, { name: 'x' }))
    // @ts-expect-error async storage has no storage events
    crossTab(persistAsync(init, { name: 'x', storage: asyncStore }))
    // @ts-expect-error must wrap persist directly, not a plain initializer
    crossTab(init)
    // the result still works anywhere an Initializer is expected
    create<S>(crossTab(persist(init, { name: 'x' })))
  })

  it('accessors are separate', () => {
    expectTypeOf(getPersistAsync(createStore<S>(init))).toEqualTypeOf<PersistAsyncApi | undefined>()
    expectTypeOf(getPersist(createStore<S>(init))).toEqualTypeOf<PersistApi | undefined>()
    expectTypeOf<PersistAsyncApi['flush']>().toEqualTypeOf<() => Promise<void>>()
    // closure is never called: only the compiler is being asked
    const _syncHasNoFlush = (api: PersistApi) =>
      // @ts-expect-error flush exists only on the async API
      api.flush
    void _syncHasNoFlush
  })
})
