import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { create } from './create'
import { persist, type SyncStorageLike as StorageLike } from './persist'
import { shallow } from './shallow'
import { useHydrated } from './react'
import { createStore, watch } from './vanilla'

const make = () => createStore(() => ({ a: 1, b: 1, list: [1] }))

describe('watch', () => {
  it('fires only when the selected value changes', () => {
    const store = make()
    const l = vi.fn()
    watch(store, (s) => s.a, l)
    store.setState({ b: 2 })
    expect(l).not.toHaveBeenCalled()
    store.setState({ a: 5 })
    expect(l).toHaveBeenCalledWith(5, 1)
    store.setState({ a: 6 })
    expect(l).toHaveBeenLastCalledWith(6, 5)
  })

  it('custom equality; unsubscribe stops it', () => {
    const store = make()
    const l = vi.fn()
    const off = watch(store, (s) => ({ a: s.a }), l, shallow)
    store.setState({ b: 9 })
    expect(l).not.toHaveBeenCalled()
    store.setState({ a: 2 })
    expect(l).toHaveBeenCalledTimes(1)
    off()
    store.setState({ a: 3 })
    expect(l).toHaveBeenCalledTimes(1)
  })

  it('works on a create() hook (it carries the store api)', () => {
    const useS = create(() => ({ n: 0 }))
    const l = vi.fn()
    watch(useS, (s) => s.n, l)
    useS.setState({ n: 1 })
    expect(l).toHaveBeenCalledWith(1, 0)
  })
})

describe('useHydrated', () => {
  const memory = (): StorageLike => {
    const d: Record<string, string> = {}
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => void (d[k] = v) }
  }

  it('false first, true after rehydrate', async () => {
    const useS = create(persist(() => ({ n: 0 }), { name: 'h', storage: memory() }))
    const { result } = renderHook(() => useHydrated(useS))
    expect(result.current).toBe(false)
    await act(async () => {})
    expect(result.current).toBe(true)
  })

  it('stays false for a store without persist', async () => {
    const useS = create(() => ({ n: 0 }))
    const { result } = renderHook(() => useHydrated(useS))
    await act(async () => {})
    expect(result.current).toBe(false)
  })
})
