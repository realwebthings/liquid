import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { create } from './create'

type S = { count: number; inc: () => void }
const make = () =>
  create<S>((set) => ({
    count: 0,
    inc: () => set((s) => ({ count: s.count + 1 })),
  }))

describe('create', () => {
  it('hook with selector', () => {
    const useCounter = make()
    const { result } = renderHook(() => useCounter((s) => s.count))
    expect(result.current).toBe(0)
    act(() => useCounter.getState().inc())
    expect(result.current).toBe(1)
  })

  it('hook without selector returns whole state', () => {
    const useCounter = make()
    const { result } = renderHook(() => useCounter())
    expect(result.current.count).toBe(0)
  })

  it('exposes store api outside React', () => {
    const useCounter = make()
    useCounter.setState({ count: 5 })
    expect(useCounter.getState().count).toBe(5)
    let seen = 0
    const off = useCounter.subscribe((s) => (seen = s.count))
    useCounter.setState({ count: 6 })
    off()
    expect(seen).toBe(6)
    expect(useCounter.getInitialState().count).toBe(0)
  })

  it('two stores are independent', () => {
    const a = make()
    const b = make()
    a.setState({ count: 1 })
    expect(b.getState().count).toBe(0)
  })
})

describe('write without rendering', () => {
  it('setState before any component mounts; first render sees it', () => {
    const useCounter = make()
    useCounter.setState({ count: 42 }) // no React, no component
    const { result } = renderHook(() => useCounter((s) => s.count))
    expect(result.current).toBe(42)
  })

  it('writing from outside updates mounted components', () => {
    const useCounter = make()
    const { result } = renderHook(() => useCounter((s) => s.count))
    act(() => useCounter.setState({ count: 7 }))
    expect(result.current).toBe(7)
  })
})
