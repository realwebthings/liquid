'use client'
import { create, useHydrated } from 'lightmight'
import { persistAsync, type AsyncStorageLike } from 'lightmight/persist-async'

// Stand-in for IndexedDB / AsyncStorage: same shape, every call is slow and async.
const slowStorage: AsyncStorageLike = {
  getItem: async (k) => (await new Promise((r) => setTimeout(r, 300)), localStorage.getItem(k)),
  setItem: async (k, v) => (await new Promise((r) => setTimeout(r, 150)), localStorage.setItem(k, v)),
}

type S = { n: number; inc: () => void }
const useAsyncCount = create<S>(
  persistAsync(
    (set) => ({ n: 0, inc: () => set((s) => ({ n: s.n + 1 })) }),
    { name: 'lightmight-demo-async', storage: slowStorage },
  ),
)

export function AsyncCounter() {
  const n = useAsyncCount((s) => s.n)
  const hydrated = useHydrated(useAsyncCount)
  return (
    <button onClick={() => useAsyncCount.getState().inc()}>
      async: {hydrated ? n : '…'}
    </button>
  )
}
