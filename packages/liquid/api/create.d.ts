import type { Initializer, Store } from './vanilla.js';
export type UseBoundStore<T> = {
    (): T;
    <U>(selector: (state: T) => U): U;
} & Store<T>;
export declare function create<T>(init: Initializer<T>): UseBoundStore<T>;
