'use client'
import { create, useHydrated } from 'lightmight'
import { crossTab } from 'lightmight/cross-tab'
import { persist } from 'lightmight/persist'

// client-only global singleton: never written on the server, so no leak
type S = { count: number; inc: () => void }
const useCount = create<S>(
  crossTab(
    persist(
      (set) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
      }),
      { name: 'lightmight-demo-count' },
    ),
  ),
)

export function GlobalCounter() {
  const count = useCount((s) => s.count)
  const hydrated = useHydrated(useCount) // avoid flashing 0 before saved data lands
  return (
    <button onClick={() => useCount.getState().inc()}>
      global: {hydrated ? count : '…'}
    </button>
  )
}

export function GlobalCounterMirror() {
  return <span> mirror: {useCount((s) => s.count)}</span>
}
