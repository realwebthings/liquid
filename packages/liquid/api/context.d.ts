import type { ReactNode } from 'react';
import type { Initializer, Store } from './vanilla.js';
export declare function createStoreContext<T>(): {
    Provider: ({ init, children, }: {
        init: Initializer<T>;
        children?: ReactNode;
    }) => import("react").JSX.Element;
    useStore: {
        (): T;
        <U>(selector: (state: T) => U): U;
    };
    useStoreApi: () => Store<T>;
};
