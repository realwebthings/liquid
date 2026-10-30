/// <reference lib="es2021.weakref" />
import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createStoreContext } from './context'
import { mutate } from './mutable'
import { crossTab } from './cross-tab'
import { persist } from './persist'
import { persistAsync } from './persist-async'
import { createStore, watch } from './vanilla'

const collect = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0))
    ;(globalThis as any).gc()
  }
}

// The detector is a payload object kept inside the state (a shallow merge keeps the
// same reference). Anything that leaks the store's internals keeps it alive.
const canGc = typeof (globalThis as any).gc === 'function'
describe.skipIf(!canGc)('garbage collection (needs --expose-gc)', () => {
  it('a store with subscribers, watchers and mutations is collected', async () => {
    let ref: WeakRef<object>
    ;(() => {
      const payload = { big: 'x'.repeat(10) }
      const store = createStore(() => ({ n: 0, payload, list: [{ a: 1 }] }))
      store.subscribe(() => {})
      watch(store, (s) => s.n, () => {})
      mutate(store, (d) => { d.list[0]!.a = 2; d.n++ })
      ref = new WeakRef(payload)
    })()
    await collect()
    expect(ref!.deref()).toBeUndefined()
  })

  it('a crossTab persist store is collected after its last unsubscribe', async () => {
    let ref: WeakRef<object>
    ;(() => {
      const payload = { big: 'x' }
      const store = createStore(crossTab(persist(() => ({ n: 0, payload }), { name: 'gc1' })))
      store.subscribe(() => {})()
      ref = new WeakRef(payload)
    })()
    await collect()
    expect(ref!.deref()).toBeUndefined()
  })

  it('an async persist store is collected once its writes finish', async () => {
    let ref: WeakRef<object>
    ;(() => {
      const payload = { big: 'x' }
      const store = createStore(
        persistAsync(() => ({ n: 0, payload }), {
          name: 'gc2',
          storage: { getItem: async () => null, setItem: async () => {} },
        }),
      )
      store.setState({ n: 1 })
      ref = new WeakRef(payload)
    })()
    await collect()
    expect(ref!.deref()).toBeUndefined()
  })

  it('Provider stores (persisted, crossTab) are collected after unmount', async () => {
    const { Provider, useStore } = createStoreContext<{ n: number; payload: { big: string } }>()
    function C() { useStore((s) => s.n); return null }
    let ref: WeakRef<object>
    const r = render(
      <Provider
        init={crossTab(
          persist(
            () => {
              const payload = { big: 'x' }
              ref = new WeakRef(payload)
              return { n: 0, payload }
            },
            { name: 'gc3' },
          ),
        )}
      >
        <C />
      </Provider>,
    )
    await act(async () => {})
    r.unmount()
    await collect()
    expect(ref!.deref()).toBeUndefined()
  })
})
