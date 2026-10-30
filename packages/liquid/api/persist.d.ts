import { type Hydration } from './persist-core.js';
import type { Initializer } from './vanilla.js';
export interface SyncStorageLike {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}
export interface PersistOptions<T, P = Partial<T>> {
    name: string;
    /** Default: localStorage. Must be synchronous; see `persistAsync` otherwise. */
    storage?: SyncStorageLike;
    partialize?: (state: T) => P;
    /** Bump when the saved shape changes. Default 0. */
    version?: number;
    /** Turn data saved under an older version into the current shape. Without it, old data is ignored. */
    migrate?: (saved: any, savedVersion: number) => Partial<T> | undefined;
}
export interface PersistApi extends Hydration {
    /** Where this store is saved. Used by `crossTab`. */
    key: string;
    storage: SyncStorageLike;
    /** Read storage again and apply it. Used by `crossTab`. */
    reload: () => void;
}
export type PersistInitializer<T> = Initializer<T> & {
    readonly __persist: 'sync';
};
export declare const getPersist: (store: object) => PersistApi | undefined;
export declare const persist: <T, P = Partial<T>>(init: Initializer<T>, { name, storage, partialize, version, migrate, }: PersistOptions<T, P>) => PersistInitializer<T>;
