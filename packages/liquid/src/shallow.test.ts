import { describe, expect, it } from 'vitest'
import { shallow } from './shallow'

describe('shallow', () => {
  it('same ref / primitives', () => {
    const o = {}
    expect(shallow(o, o)).toBe(true)
    expect(shallow(1, 1)).toBe(true)
    expect(shallow(1, 2)).toBe(false)
    expect(shallow(NaN, NaN)).toBe(true)
  })
  it('equal keys and values', () => {
    expect(shallow({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
  })
  it('different value / key count / key name', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(shallow({ a: undefined }, { b: undefined })).toBe(false)
  })
  it('does not go deep', () => {
    expect(shallow({ a: {} }, { a: {} })).toBe(false)
  })
  it('arrays', () => {
    expect(shallow([1, 2], [1, 2])).toBe(true)
    expect(shallow([1, 2], [1, 3])).toBe(false)
    expect(shallow([], {})).toBe(false)
  })
  it('null', () => {
    expect(shallow(null, {})).toBe(false)
  })
})
