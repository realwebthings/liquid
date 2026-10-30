# Changelog

All notable changes to `liquid` are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/). Nothing is published yet, so everything below
is the first release's baseline: the changes under "Changed" are pre-release design changes,
not breaking changes for any user. From the first release on, `npm run api` blocks any
removed or changed export without a major version.

## [Unreleased]

### Added
- `createStore(init)` (`liquid/vanilla`): closure store with `getState`, `setState`
  (partial or updater, shallow merge), `subscribe`, `getInitialState`. No React dependency.
  Initializer receives `(set, get, api)`.
- `watch(store, selector, listener, equal?)` (`liquid/vanilla`): listen to one slice outside React.
- `useStore(store, selector?)`: React binding on `useSyncExternalStore`; the server snapshot
  is `getInitialState()` so hydration matches.
- `shallow(a, b)` (`liquid/shallow`) and `useShallow(selector)` for selectors that return
  new objects or arrays.
- `create(init)`: returns a hook that also carries the store API, so state can be read and
  written outside React with no render.
- `createStoreContext<T>()`: `Provider`, `useStore`, `useStoreApi`. Per-request stores for SSR
  and isolated local state per subtree.
- **Sync persistence** `persist(init, options)` (`liquid/persist`): `localStorage`-style storage.
  Options `name`, `storage`, `partialize`, `version`, `migrate`. Status via `getPersist(store)`.
- **Async persistence** `persistAsync(init, options)` (`liquid/persist-async`): Promise-based
  storage (IndexedDB, AsyncStorage). Same options plus a required `storage` and `onError`;
  `getPersistAsync(store).flush()`. Writes are ordered, coalesced, and latest-state-wins.
- Sync and async are separate imports with separate storage types (`SyncStorageLike`,
  `AsyncStorageLike`). Passing one kind to the other is a compile error.
- `crossTab(persist(...))` (`liquid/cross-tab`): apply saves from other tabs; sync only.
  `crossTab(persistAsync(...))` is a compile error.
- `useHydrated(store)`: works with both persist kinds; avoids a flash of default values.
- `produce(base, recipe)` and `mutate(store, recipe)` (`liquid/mutable`): Proxy/Reflect
  copy-on-write drafts, so `d.a.b = 1` and `d.list.push(x)` produce new immutable state.
- `'use client'` banner on the main entry; the other entries stay usable from server code.
- ESM and CJS builds with `.d.ts` and `.d.cts` types, `exports` map with `typesVersions`,
  `sideEffects: false`, `react >= 18` peer, `engines.node >= 18`.
- `examples/next-app`: per-request store, local state, sync persist with `crossTab`, async persist.
- README with API docs and a sync-vs-async table.

### Changed
- `crossTab` is a wrapper in its own entry, not an option of `persist`. It was 132 B of
  `persist`'s 594 B gzip, and only some apps use it.
- Nothing is written to storage before the first load finishes (sync and async). Before this,
  a write in the first moments after creation could overwrite stored data with defaults.
  Such early writes are not saved, and the stored value wins.
- `crossTab` registers its `storage` listener only while the store has subscribers, and removes
  it on the last unsubscribe. The first version added a listener that was never removed,
  which leaked every Provider-created store.
- `produce` stores plain data when a draft is assigned elsewhere (`d.alias = d.user`). Before,
  a live proxy could end up inside state.
- Persisted format is `{ state, version }`.
- `shallow` trimmed by 12 B gzip with identical behavior.

### Added (release safety)
- `npm run api`: public API guard. `api/` snapshots every export name and `.d.ts`; the build
  fails if an export is removed or a signature changes (reported as BREAKING) or anything is
  added (reported as additive, accepted with `npm run api:update`). Checked with controls that
  remove an export, tighten a signature, and add an export.
- `npm run verify` (types, tests, build, size budgets, API guard), run by `prepublishOnly`.

### Verified
- 98 tests (vitest + jsdom): runtime behavior, compile-time types (`expectTypeOf`,
  `@ts-expect-error`), and garbage collection. GC tests drop every reference, force a collection
  (`--expose-gc`), and assert stores were freed; the detector was checked with a control that
  deliberately keeps a reference.
- Real-browser run (Chrome via playwright-core) against `next start`: per-request SSR seeding,
  no leak across requests, persisted counter after reload, isolated local stores, live cross-tab
  sync, async persist with slow storage (placeholder while reading, newest write wins, an early
  click does not clobber saved data), zero console errors or hydration warnings. 21 of 21 checks.
  `next dev` earlier: same result for the first 11.
- `publint` and `@arethetypeswrong/cli`: no problems for all 7 entries.
- Clean-project install of the packed tarball with React 18.3.1 and 19.3.1: every entry runs under
  ESM and CJS (SSR render, Provider, both persist kinds, `crossTab`, `produce`, `watch`), and a
  TypeScript 5.9 file type-checks under `bundler`, `node10`, `node16` ESM and `node16` CJS with
  `skipLibCheck: false`, including the expected sync/async compile errors (12 of 12).
- `dist` uses no syntax newer than ES2020.
- Per-export bundle cost is measured and budgeted by `npm run size`; the build fails if an
  export grows past its budget.

### Known limitations
- Async storage has no cross-tab sync (it has no change events).
- Setting a field to its current value still notifies listeners (selectors prevent re-renders).
- Calling `set` or `get` synchronously inside `init` sees `undefined` state.
- A server component cannot pass `init` (a function) to a Provider; use a small client wrapper.
- `produce` does not draft `Map`, `Set`, `Date`, or class instances. A draft assigned elsewhere
  is stored as its state at that moment; later writes to the draft do not follow it.
- Only Chrome was used for browser checks.
- No LICENSE file yet; add one before publishing.
