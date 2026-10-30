'use client'
import { useStore } from './react'
import { createStore } from './vanilla'
import type { Initializer, Store } from './vanilla'

export type UseBoundStore<T> = {
  (): T
  <U>(selector: (state: T) => U): U
} & Store<T>

export function create<T>(init: Initializer<T>): UseBoundStore<T> {
  const store = createStore(init)
  const useBound = <U>(selector?: (state: T) => U) =>
    useStore(store, selector as (state: T) => U)
  return Object.assign(useBound, store) as UseBoundStore<T>
}
