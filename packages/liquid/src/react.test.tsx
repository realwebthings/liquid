import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useShallow, useStore } from './react'
import { createStore } from './vanilla'

const make = () => createStore(() => ({ count: 0, name: 'a' }))

describe('useStore', () => {
  it('reads state and re-renders on change', () => {
    const store = make()
    const { result } = renderHook(() => useStore(store, (s) => s.count))
    expect(result.current).toBe(0)
    act(() => store.setState({ count: 1 }))
    expect(result.current).toBe(1)
  })

  it('does not re-render when selected slice is unchanged', () => {
    const store = make()
    let renders = 0
    renderHook(() => {
      renders++
      return useStore(store, (s) => s.count)
    })
    const before = renders
    act(() => store.setState({ name: 'b' }))
    expect(renders).toBe(before)
  })

  it('without selector returns whole state', () => {
    const store = make()
    const { result } = renderHook(() => useStore(store))
    expect(result.current).toBe(store.getState())
  })

  it('unsubscribes on unmount', () => {
    const store = make()
    const { unmount } = renderHook(() => useStore(store))
    unmount()
    expect(() => act(() => store.setState({ count: 5 }))).not.toThrow()
  })
})

describe('selector stability', () => {
  it('BUG: selector returning fresh object loops forever', () => {
    const store = make()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      renderHook(() => useStore(store, (s) => ({ count: s.count }))),
    ).toThrow()
    spy.mockRestore()
  })

  it('FIX: useShallow returns stable ref', () => {
    const store = make()
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useStore(
        store,
        useShallow((s: { count: number; name: string }) => ({ count: s.count })),
      )
    })
    expect(result.current).toEqual({ count: 0 })
    const before = renders
    act(() => store.setState({ name: 'b' }))
    expect(renders).toBe(before)
    act(() => store.setState({ count: 1 }))
    expect(result.current).toEqual({ count: 1 })
  })
})
