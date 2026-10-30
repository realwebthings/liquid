'use client'
import { useRef, useSyncExternalStore } from 'react'
import { shallow } from './shallow'
import type { Store } from './vanilla'

export function useStore<T>(store: Store<T>): T
export function useStore<T, U>(store: Store<T>, selector: (state: T) => U): U
export function useStore<T, U>(
  store: Store<T>,
  selector: (state: T) => U = (s) => s as unknown as U,
): U {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getInitialState()),
  )
}

export function useShallow<T, U>(selector: (state: T) => U): (state: T) => U {
  const prev = useRef<U>(undefined as U)
  return (state) => {
    const next = selector(state)
    return shallow(prev.current, next) ? prev.current : (prev.current = next)
  }
}

const noSubscribe = () => () => {}

type Hydration = { hasHydrated: () => boolean; onHydrated: (cb: () => void) => () => void }

// true once a persisted store (sync or async) has applied saved data; false on the server
export function useHydrated(store: object): boolean {
  const s = store as { persist?: Hydration; persistAsync?: Hydration }
  const p = s.persist ?? s.persistAsync
  return useSyncExternalStore(
    p ? p.onHydrated : noSubscribe,
    () => !!p?.hasHydrated(),
    () => false,
  )
}
