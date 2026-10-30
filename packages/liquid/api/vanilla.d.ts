export type Listener<T> = (state: T, prev: T) => void;
export type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
export interface Store<T> {
    getState: () => T;
    getInitialState: () => T;
    setState: SetState<T>;
    subscribe: (listener: Listener<T>) => () => void;
}
export type Initializer<T> = (set: SetState<T>, get: () => T, api: Store<T>) => T;
export declare function createStore<T>(init: Initializer<T>): Store<T>;
export declare function watch<T, U>(store: Pick<Store<T>, 'getState' | 'subscribe'>, selector: (state: T) => U, listener: (value: U, prev: U) => void, equal?: (a: U, b: U) => boolean): () => void;
