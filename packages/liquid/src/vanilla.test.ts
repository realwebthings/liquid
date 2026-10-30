import { describe, expect, it, vi } from 'vitest'
import { createStore } from './vanilla'

type S = { count: number; name: string; inc: () => void }
const make = () =>
  createStore<S>((set) => ({
    count: 0,
    name: 'a',
    inc: () => set((s) => ({ count: s.count + 1 })),
  }))

describe('createStore', () => {
  it('returns initial state', () => {
    expect(make().getState().count).toBe(0)
  })

  it('merges partial object', () => {
    const s = make()
    s.setState({ count: 5 })
    expect(s.getState()).toMatchObject({ count: 5, name: 'a' })
  })

  it('supports updater fn and actions inside state', () => {
    const s = make()
    s.getState().inc()
    s.getState().inc()
    expect(s.getState().count).toBe(2)
  })

  it('creates new state reference each update', () => {
    const s = make()
    const before = s.getState()
    s.setState({ count: 1 })
    expect(s.getState()).not.toBe(before)
  })

  it('notifies listeners with (state, prev)', () => {
    const s = make()
    const l = vi.fn()
    s.subscribe(l)
    const prev = s.getState()
    s.setState({ count: 1 })
    expect(l).toHaveBeenCalledWith(s.getState(), prev)
  })

  it('unsubscribe stops notifications', () => {
    const s = make()
    const l = vi.fn()
    const off = s.subscribe(l)
    off()
    s.setState({ count: 1 })
    expect(l).not.toHaveBeenCalled()
  })

  it('skips notify when updater returns same state', () => {
    const s = make()
    const l = vi.fn()
    s.subscribe(l)
    s.setState((st) => st)
    expect(l).not.toHaveBeenCalled()
  })

  it('listener can unsubscribe itself during notify', () => {
    const s = make()
    const other = vi.fn()
    const off = s.subscribe(() => off())
    s.subscribe(other)
    s.setState({ count: 1 })
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('getInitialState stays constant', () => {
    const s = make()
    const init = s.getInitialState()
    s.setState({ count: 9 })
    expect(s.getInitialState()).toBe(init)
  })
})
