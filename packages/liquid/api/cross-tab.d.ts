import type { PersistInitializer } from './persist.js';
import type { Initializer } from './vanilla.js';
export declare const crossTab: <T>(init: PersistInitializer<T>) => Initializer<T>;
