# lightmight

Tiny React state management. A store is a closure, a hook is `useSyncExternalStore`.
About 360 B min+gzip for `create`, no dependencies, `react >= 18` as a peer.
Every extra feature is its own import: you only ship what you import.

```bash
npm i lightmight
# or: yarn add lightmight / pnpm add lightmight
```

## Quick start

```tsx
import { create } from 'lightmight'

const useCounter = create<{ count: number; inc: () => void }>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}))

function Counter() {
  const count = useCounter((s) => s.count) // re-renders only when count changes
  return <button onClick={() => useCounter.getState().inc()}>{count}</button>
}
```

Actions live inside the state. There are no reducers, action types, or providers.

## Set data without rendering anything

The store does not depend on React. You can read and write it from anywhere:
event handlers, timers, API callbacks, tests, scripts, before the app mounts.

```ts
useCounter.setState({ count: 10 })        // write, no component involved
useCounter.setState((s) => ({ count: s.count + 1 }))
useCounter.getState().count               // read, no subscription
useCounter.subscribe((state, prev) => {}) // returns an unsubscribe function
```

- A write before the first render is what the first render sees.
- A write while components are mounted re-renders only those that selected the changed data.
- Need no React at all (Node, workers, server code)? Import from `lightmight/vanilla`:

```ts
import { createStore } from 'lightmight/vanilla'
const store = createStore(() => ({ token: null as string | null }))
store.setState({ token: 'abc' })
```

## API

### `create<T>(init) => useBoundStore`
`init(set, get, api)` returns the initial state (data and actions).
The returned hook has two call forms and carries the store API:

| Use | What it does |
|---|---|
| `useStore()` | whole state, re-renders on any change |
| `useStore(selector)` | selected value, re-renders when it changes (`Object.is`) |
| `useStore.getState()` | current state, no subscription |
| `useStore.setState(partial \| fn)` | shallow merge into state, notifies listeners |
| `useStore.subscribe(listener)` | `listener(state, prev)`; returns unsubscribe |
| `useStore.getInitialState()` | state at creation; used for SSR |

### `setState(partial | (state) => partial)`
Shallow merges. State is replaced by a new object on every update, so untouched
fields keep their reference. If an updater returns the same state object, nothing
is notified. Setting a field to the value it already has still notifies, but
selectors stop any re-render.

### `createStore<T>(init) => Store<T>` (`lightmight/vanilla`)
The same store without the hook: `getState`, `setState`, `subscribe`, `getInitialState`.

### `useStore(store, selector?)`
Hook for a store from `createStore`. `create` is `createStore` plus this.

### `useShallow(selector)` and `shallow(a, b)`
A selector must return the same reference when nothing relevant changed.
Returning a fresh object or array every call loops in React. Wrap it:

```tsx
import { useShallow } from 'lightmight'
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })))
```

`shallow` compares one level deep and is also exported from `lightmight/shallow`.

### `createStoreContext<T>()` (per-request and local state)
Returns `{ Provider, useStore, useStoreApi }`. Each `Provider` creates its own store from
`init`, once. Use it when state must not be shared:

- **Next.js / SSR:** a module-level store is shared by every request on the server.
  Create the store per request inside a Provider.
- **Local state:** a Provider around a subtree gives each instance its own store.

```tsx
const { Provider, useStore, useStoreApi } = createStoreContext<State>()

<Provider init={(set) => ({ user, setUser: (u) => set({ user: u }) })}>
  <App />
</Provider>

const user = useStore((s) => s.user)  // subscribes
const api = useStoreApi()             // store only: write without re-rendering
api.setState({ user: 'x' })
```

`useStore` throws outside its Provider.

### `watch(store, selector, listener, equal?)`
Run a side effect when one slice changes, outside React. Fires only when the selected
value changes (`Object.is`, or your `equal`, e.g. `shallow`). Returns an unsubscribe function.

```ts
import { watch } from 'lightmight/vanilla'
const off = watch(useAuth, (s) => s.token, (token, prev) => api.setToken(token))
```

## Saving state: sync and async are separate

Two functions, two imports, two storage types. They never share options or methods,
and the compiler rejects mixing them.

| | **Sync** | **Async** |
|---|---|---|
| Import | `lightmight/persist` | `lightmight/persist-async` |
| Function | `persist` | `persistAsync` |
| Storage | `localStorage`, `sessionStorage` (`getItem` returns a value) | IndexedDB, React Native AsyncStorage, a server (`getItem` returns a Promise) |
| Type | `SyncStorageLike` | `AsyncStorageLike` |
| Storage option | optional, default `localStorage` | **required**, there is no default |
| Status object | `getPersist(store)` | `getPersistAsync(store)` |
| Only here | `crossTab` wrapper | `onError`, `flush()` |
| Same on both | `name`, `partialize`, `version`, `migrate`, `useHydrated(store)` | |

```ts
import { persist } from 'lightmight/persist'
const useA = create<S>(persist(init, { name: 'a' }))                        // localStorage

import { persistAsync } from 'lightmight/persist-async'
const useB = create<S>(persistAsync(init, { name: 'b', storage: idbStorage })) // async
```

```ts
persist(init, { name: 'a', storage: idbStorage })       // type error: async storage in sync persist
persistAsync(init, { name: 'b', storage: localStorage }) // type error: sync storage in async persist
```

Saved format is `{ "state": ..., "version": n }`. Functions are never saved (JSON) and
survive loading. Saved data is applied right after the store is created, never inside `init`,
so server HTML and the first client render match. The saved value appears one render later.

**Rules that hold for both:**
- Nothing is written before the first load finishes. Otherwise a write made in the first
  moments would overwrite stored data with defaults. Writes made before that are not saved,
  and the stored value wins.
- Data applied from storage is never written back. A migrated shape is written once.
- Corrupt data and blocked storage are ignored; the store keeps working.
- `getInitialState()` stays the pre-load state, which is what the server rendered.

### `persist(init, options)` (sync, `lightmight/persist`)

| Option | Default | |
|---|---|---|
| `name` | required | storage key |
| `storage` | `localStorage` | any `SyncStorageLike`: `{ getItem, setItem }` returning values |
| `partialize` | whole state | pick the fields to save |
| `version` | `0` | bump when the saved shape changes |
| `migrate(saved, savedVersion)` | none | return the current shape; without it, older data is ignored |

```ts
persist(init, {
  name: 'settings',
  version: 2,
  migrate: (saved, v) => (v === 1 ? { theme: saved.color } : undefined),
})
```

### `persistAsync(init, options)` (async, `lightmight/persist-async`)

Same `name`, `partialize`, `version`, `migrate`, plus:

| Option | |
|---|---|
| `storage` | **required** `AsyncStorageLike`: `{ getItem, setItem }` returning Promises |
| `onError(error)` | a read or write failed; without it failures are ignored |

```ts
import { get, set } from 'idb-keyval'
const idbStorage = { getItem: (k) => get(k).then((v) => v ?? null), setItem: (k, v) => set(k, v) }

const useDoc = create<S>(persistAsync(init, { name: 'doc', storage: idbStorage, onError: console.error }))
```

- The read takes real time, so use `useHydrated` to avoid showing defaults first.
- Writes run one at a time, in order, and each writes the latest state: a slow older write
  can never land after a newer one, and a burst of updates becomes one write.
- `getPersistAsync(store).flush()` resolves when every write started so far has finished
  (await it before closing a window or running a test).
- There is no cross-tab sync for async storage, because async storage has no change events.

### `crossTab(persist(...))` (`lightmight/cross-tab`, sync only)
Apply saves made in other tabs. Wrap a sync `persist` directly:

```ts
import { crossTab } from 'lightmight/cross-tab'
const useCount = create<S>(crossTab(persist(init, { name: 'count' })))
```

It is a separate import so apps that don't need it don't pay for it. `crossTab(persistAsync(...))`
and `crossTab(plainInit)` are type errors. The `storage` window listener exists only while the
store has subscribers (mounted components, `watch`), and it catches up on anything missed
when the first subscriber returns.

### `useHydrated(store)`
`false` on the server and the first client render, then `true` once saved data is applied
(also `true` if nothing was saved). Works with both `persist` and `persistAsync`.

```tsx
const hydrated = useHydrated(useCount)
return <b>{hydrated ? count : '…'}</b>
```

`getPersist(store)` / `getPersistAsync(store)` give `{ hasHydrated(), onHydrated(cb) }`
outside React, or `undefined` if the store does not use that one.

## Async actions

State updates are always synchronous: `setState` and `getState` never return Promises.
An async action is just an `async` function in your state that calls `set` when it is done:

```ts
const useUsers = create<S>((set) => ({
  users: [], loading: false,
  load: async () => {
    set({ loading: true })
    const users = await fetch('/api/users').then((r) => r.json())
    set({ users, loading: false })
  },
}))
```

Nothing special is needed, and nothing is added to the library for it.

## Mutable-style updates: `produce` and `mutate` (`lightmight/mutable`)
Optional. Write plain mutations and get a new immutable state. Built on `Proxy` and
`Reflect`; only the objects on the written path are copied.

```ts
import { mutate } from 'lightmight/mutable'

mutate(useStore, (d) => {
  d.user.name = 'z'
  d.todos.push({ id: 3, done: false })
  d.count++
})

// inside an action:
inc: () => set((s) => produce(s, (d) => { d.count++ }))
```

- Untouched branches keep their reference, so selectors on them do not re-render.
- A recipe that writes nothing returns the same state: no notify.
- Plain objects and arrays are drafted. `Date`, `Map`, `Set`, and class instances are
  opaque: replace them, do not mutate them in place.
- Use the draft only inside the recipe. Do not return a value from the recipe.
- Assigning a draft to another place (`d.alias = d.user`) stores plain data, never a live proxy.

## Next.js

1. Client-only global UI state (modal, theme): `create()` in a file marked `'use client'` is fine.
2. Per-request or user-specific state: `createStoreContext` with a Provider. A Server
   Component cannot pass the `init` function to a client Provider, because functions cannot
   cross that boundary. Make a small client wrapper that takes plain data and builds `init`:

```tsx
'use client'
export function UserProvider({ user, children }: { user: string; children: React.ReactNode }) {
  return (
    <Ctx.Provider init={(set) => ({ user, setUser: (u) => set({ user: u }) })}>
      {children}
    </Ctx.Provider>
  )
}
```

3. Import `lightmight/vanilla` or `lightmight/shallow` from server code. The main entry is a client module.

On the server the hook reads `getInitialState()`, so server output never depends on later writes.

## Size: you pay only for what you import

Each row is what one export adds to an app that imports **only that**, bundled and minified
with esbuild (`react` external), gzip level 9. `npm run size` re-measures this from the built
package and fails if any row grows past its budget.

| You import | gzip |
|---|---|
| `createStore` (`lightmight/vanilla`, no React) | 226 B |
| `watch` (includes `createStore`) | 280 B |
| `create` | 356 B |
| `useStore` + `createStore` | 344 B |
| `useShallow` / `shallow` | 331 B / 206 B |
| `useHydrated` | 215 B |
| `createStoreContext` | 482 B |
| `persist` (sync) | 449 B |
| `persistAsync` | 479 B |
| `crossTab` | 255 B |
| `produce` / `mutate` | 514 B |
| `create` + `persist` | 724 B |

Zustand 5, measured the same way: `create` 405 B, `create` + `persist` 1339 B.
Zustand's `persist` has more options (for example `skipHydration` and `onRehydrateStorage`).
Rows do not add up: shared code is counted in each row.
The npm tarball is bigger than these numbers, because it holds ESM, CJS and type files. Apps
bundle only what they import.

## Memory safety

- A store holds only its own listeners. Nothing global is registered, except by `crossTab`.
- `crossTab` adds one `storage` listener while the store has at least one subscriber and
  removes it when the last one unsubscribes, so stores created inside a Provider are freed
  on unmount.
- `subscribe` and `watch` return an unsubscribe function; React hooks call it for you.
- `persistAsync` keeps a store alive only while its writes are pending.
- `produce` never leaves a draft proxy in your state.
- Tests create stores, drop every reference, force a garbage collection, and assert they were
  collected (`src/gc.test.tsx`, run with `--expose-gc`).

## Stability

`lightmight` follows SemVer. The public API is every export of every entry (`lightmight`,
`lightmight/vanilla`, `lightmight/shallow`, `lightmight/persist`, `lightmight/persist-async`, `lightmight/cross-tab`,
`lightmight/mutable`) and its types. `api/` holds a snapshot of it, and `npm run api` fails the
build if a name is removed, or a signature is changed or removed. Such a change needs a new
major version. Additions only need `npm run api:update` and a CHANGELOG entry.
`prepublishOnly` runs `npm run verify` (types, tests, build, size budgets, API check).

Tested against React 18.3 and 19.3, ESM and CJS, and TypeScript 5.9 under `bundler`, `node10`
and `node16` (ESM and CJS) resolution with `skipLibCheck: false`.

## Development

```bash
npm run verify              # everything a release needs
npm test -w lightmight          # vitest: runtime, compile-time types, garbage collection
npm run build -w lightmight     # tsup + tsc declarations
npm run size -w lightmight      # per-export bundle cost, fails over budget
npm run api -w lightmight       # public API guard (api:update to accept a change)
npm run dev -w next-app     # example app
```
