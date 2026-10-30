// ASYNC persistence: storage whose getItem/setItem return Promises (IndexedDB,
// React Native AsyncStorage, a server). For localStorage use `liquid/persist`.
import { decode, encode, type Hydration } from './persist-core'
import type { Initializer } from './vanilla'

export interface AsyncStorageLike {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}

export interface PersistAsyncOptions<T, P = Partial<T>> {
  name: string
  /** Required: there is no default async storage. */
  storage: AsyncStorageLike
  partialize?: (state: T) => P
  /** Bump when the saved shape changes. Default 0. */
  version?: number
  /** Turn data saved under an older version into the current shape. Without it, old data is ignored. */
  migrate?: (saved: any, savedVersion: number) => Partial<T> | undefined
  /** A read or write failed. Without it, failures are ignored. */
  onError?: (error: unknown) => void
}

export interface PersistAsyncApi extends Hydration {
  /** Resolves when every write started so far has finished. */
  flush: () => Promise<void>
}

// Type-only brand: not accepted by `crossTab` (async storage has no storage events).
export type PersistAsyncInitializer<T> = Initializer<T> & { readonly __persist: 'async' }

export const getPersistAsync = (store: object) =>
  (store as { persistAsync?: PersistAsyncApi }).persistAsync

export const persistAsync =
  <T, P = Partial<T>>(
    init: Initializer<T>,
    { name, storage, partialize, version = 0, migrate, onError }: PersistAsyncOptions<T, P>,
  ): PersistAsyncInitializer<T> =>
  ((set, get, api) => {
    const state = init(set, get, api)

    let hydrating = false
    let hydrated = false
    let dirty = false
    let writes: Promise<void> = Promise.resolve()
    const waiting = new Set<() => void>()

    // Writes run one at a time, in order, and each writes the latest state, so an
    // older slow write can never land after a newer one.
    const save = () => {
      dirty = true
      writes = writes.then(async () => {
        if (!dirty) return
        dirty = false
        try {
          await storage.setItem(name, encode(partialize ? partialize(get()) : get(), version))
        } catch (e) {
          onError?.(e)
        }
      })
    }

    const load = (raw: string) => {
      try {
        const r = decode<T>(raw, version, migrate)
        if (r) {
          hydrating = true
          set(r.next)
          if (r.migrated) save()
        }
      } catch (e) {
        onError?.(e)
      } finally {
        hydrating = false
      }
    }

    // Nothing is saved before the first load: it would overwrite stored data with defaults.
    api.subscribe(() => hydrating || !hydrated || save())

    // Never inside init (see liquid/persist); here the wait is real, so use useHydrated.
    queueMicrotask(async () => {
      try {
        const raw = await storage.getItem(name)
        if (raw) load(raw)
      } catch (e) {
        onError?.(e)
      }
      hydrated = true
      waiting.forEach((cb) => cb())
    })

    ;(api as { persistAsync?: PersistAsyncApi }).persistAsync = {
      hasHydrated: () => hydrated,
      onHydrated: (cb) => (waiting.add(cb), () => void waiting.delete(cb)),
      flush: () => writes,
    }
    return state
  }) as PersistAsyncInitializer<T> // the brand exists only in types
