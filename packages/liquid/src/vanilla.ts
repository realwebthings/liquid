export type Listener<T> = (state: T, prev: T) => void

export type SetState<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
) => void

export type Initializer<T> = (set: SetState<T>, get: () => T) => T

export interface Store<T> {
  getState: () => T
  getInitialState: () => T
  setState: SetState<T>
  subscribe: (listener: Listener<T>) => () => void
}

export function createStore<T>(init: Initializer<T>): Store<T> {
  let state: T
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

  const initialState = (state = init(setState, getState))
  const getInitialState = () => initialState

  return { getState, getInitialState, setState, subscribe }
}
