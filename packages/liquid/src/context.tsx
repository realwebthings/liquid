'use client'
import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { useStore } from './react'
import { createStore } from './vanilla'
import type { Initializer, Store } from './vanilla'

export function createStoreContext<T>() {
  const Context = createContext<Store<T> | null>(null)

  function Provider({
    init,
    children,
  }: {
    init: Initializer<T>
    children?: ReactNode
  }) {
    const ref = useRef<Store<T>>(null)
    ref.current ??= createStore(init)
    return <Context.Provider value={ref.current}>{children}</Context.Provider>
  }

  function useStoreApi(): Store<T> {
    const store = useContext(Context)
    if (!store) throw new Error('useStore must be used inside its Provider')
    return store
  }

  function useBound(): T
  function useBound<U>(selector: (state: T) => U): U
  function useBound<U>(selector?: (state: T) => U) {
    return useStore(useStoreApi(), selector as (state: T) => U)
  }

  return { Provider, useStore: useBound, useStoreApi }
}
