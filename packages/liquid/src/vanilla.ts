export type Listener<T> = (state: T, prev: T) => void

export type SetState<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
) => void

export interface Store<T> {
  getState: () => T
  getInitialState: () => T
  setState: SetState<T>
  subscribe: (listener: Listener<T>) => () => void
}

export type Initializer<T> = (
  set: SetState<T>,
  get: () => T,
  api: Store<T>,
) => T

export function createStore<T>(init: Initializer<T>): Store<T> {
  let state: T
  let initialState: T
  const listeners = new Set<Listener<T>>()

  const getState = () => state

  const setState: SetState<T> = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    if (!Object.is(next, state)) {
      const prev = state
      state = Object.assign({}, state, next)
      listeners.forEach((l) => l(state, prev))
    }
  }

  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const getInitialState = () => initialState

  const api = { getState, getInitialState, setState, subscribe }
  initialState = state = init(setState, getState, api)
  return api
}

// Listen to one slice of a store, outside React. `listener` runs only when the
// selected value changes (Object.is by default). Returns an unsubscribe function.
export function watch<T, U>(
  store: Pick<Store<T>, 'getState' | 'subscribe'>,
  selector: (state: T) => U,
  listener: (value: U, prev: U) => void,
  equal: (a: U, b: U) => boolean = Object.is,
): () => void {
  let current = selector(store.getState())
  return store.subscribe((state) => {
    const next = selector(state)
    if (!equal(current, next)) {
      const prev = current
      current = next
      listener(next, prev)
    }
  })
}
