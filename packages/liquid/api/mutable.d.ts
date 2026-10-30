import type { Store } from './vanilla.js';
export declare function produce<T extends object>(base: T, recipe: (draft: T) => void): T;
export declare const mutate: <T extends object>(store: Pick<Store<T>, 'setState'>, recipe: (draft: T) => void) => void;
