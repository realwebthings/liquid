// Opt-in: apply saves made in other tabs. Wrap a SYNC persist directly:
//   create(crossTab(persist(init, { name: 'x' })))
// Async storage (IndexedDB, ...) has no cross-tab events, so persistAsync is rejected.
import type { PersistApi, PersistInitializer } from './persist'
import type { Initializer } from './vanilla'

export const crossTab =
  <T>(init: PersistInitializer<T>): Initializer<T> =>
  (set, get, api) => {
    const state = init(set, get, api)
    const p = (api as { persist?: PersistApi }).persist
    if (!p || typeof window === 'undefined') return state // no storage (SSR, blocked): nothing to sync

    // The window listener exists only while the store has subscribers, so a store
    // nobody listens to holds nothing global and can be garbage collected.
    const onStorage = (e: StorageEvent) => {
      if (e.key === p.key && e.storageArea === p.storage) p.reload()
    }
    const subscribe = api.subscribe
    let count = 0
    api.subscribe = (listener) => {
      if (!count++) {
        window.addEventListener('storage', onStorage)
        if (p.hasHydrated()) p.reload() // catch up on saves missed while nobody listened
      }
      const off = subscribe(listener)
      let live = true
      return () => {
        if (!live) return
        live = false
        off()
        if (!--count) window.removeEventListener('storage', onStorage)
      }
    }
    return state
  }
