// SYNC persistence: storage whose getItem/setItem return values directly
// (localStorage, sessionStorage). For async storage use `liquid/persist-async`.
import { decode, encode, type Hydration } from './persist-core'
import type { Initializer } from './vanilla'

export interface SyncStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface PersistOptions<T, P = Partial<T>> {
  name: string
  /** Default: localStorage. Must be synchronous; see `persistAsync` otherwise. */
  storage?: SyncStorageLike
  partialize?: (state: T) => P
  /** Bump when the saved shape changes. Default 0. */
  version?: number
  /** Turn data saved under an older version into the current shape. Without it, old data is ignored. */
  migrate?: (saved: any, savedVersion: number) => Partial<T> | undefined
}

export interface PersistApi extends Hydration {
  /** Where this store is saved. Used by `crossTab`. */
  key: string
  storage: SyncStorageLike
  /** Read storage again and apply it. Used by `crossTab`. */
  reload: () => void
}

// Type-only brand: `crossTab` accepts only a sync `persist`, never `persistAsync`.
export type PersistInitializer<T> = Initializer<T> & { readonly __persist: 'sync' }

const defaultStorage = (): SyncStorageLike | undefined => {
  try {
    return localStorage
  } catch {
    return undefined // SSR, or access blocked
  }
}

export const getPersist = (store: object) =>
  (store as { persist?: PersistApi }).persist

export const persist =
  <T, P = Partial<T>>(
    init: Initializer<T>,
    {
      name,
      storage = defaultStorage(),
      partialize,
      version = 0,
      migrate,
    }: PersistOptions<T, P>,
  ): PersistInitializer<T> =>
  ((set, get, api) => {
    const state = init(set, get, api)
    if (!storage) return state

    let hydrating = false
    let hydrated = false
    const waiting = new Set<() => void>()

    const save = () => {
      try {
        storage.setItem(name, encode(partialize ? partialize(get()) : get(), version))
      } catch {}
    }

    const load = (raw: string) => {
      try {
        const r = decode<T>(raw, version, migrate)
        if (r) {
          hydrating = true // applying saved data must not write it back
          set(r.next)
          if (r.migrated) save() // store the migrated shape once
        }
      } catch {} finally {
        hydrating = false
      }
    }

    const read = () => {
      try {
        const raw = storage.getItem(name)
        if (raw) load(raw)
      } catch {}
    }

    // Nothing is saved before the first load: it would overwrite stored data with defaults.
    api.subscribe(() => hydrating || !hydrated || save())

    // Rehydrate after creation, never inside init: getInitialState() must stay
    // equal to what the server rendered, or hydration would mismatch.
    queueMicrotask(() => {
      read()
      hydrated = true
      waiting.forEach((cb) => cb())
    })

    ;(api as { persist?: PersistApi }).persist = {
      key: name,
      storage,
      reload: read,
      hasHydrated: () => hydrated,
      onHydrated: (cb) => (waiting.add(cb), () => void waiting.delete(cb)),
    }
    return state
  }) as PersistInitializer<T> // the brand exists only in types
