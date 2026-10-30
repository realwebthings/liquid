import { type Hydration } from './persist-core.js';
import type { Initializer } from './vanilla.js';
export interface AsyncStorageLike {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}
export interface PersistAsyncOptions<T, P = Partial<T>> {
    name: string;
    /** Required: there is no default async storage. */
    storage: AsyncStorageLike;
    partialize?: (state: T) => P;
    /** Bump when the saved shape changes. Default 0. */
    version?: number;
    /** Turn data saved under an older version into the current shape. Without it, old data is ignored. */
    migrate?: (saved: any, savedVersion: number) => Partial<T> | undefined;
    /** A read or write failed. Without it, failures are ignored. */
    onError?: (error: unknown) => void;
}
export interface PersistAsyncApi extends Hydration {
    /** Resolves when every write started so far has finished. */
    flush: () => Promise<void>;
}
export type PersistAsyncInitializer<T> = Initializer<T> & {
    readonly __persist: 'async';
};
export declare const getPersistAsync: (store: object) => PersistAsyncApi | undefined;
export declare const persistAsync: <T, P = Partial<T>>(init: Initializer<T>, { name, storage, partialize, version, migrate, onError }: PersistAsyncOptions<T, P>) => PersistAsyncInitializer<T>;
