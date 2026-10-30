import type { Store } from './vanilla.js';
export declare function useStore<T>(store: Store<T>): T;
export declare function useStore<T, U>(store: Store<T>, selector: (state: T) => U): U;
export declare function useShallow<T, U>(selector: (state: T) => U): (state: T) => U;
export declare function useHydrated(store: object): boolean;
