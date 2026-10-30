export declare const encode: (state: unknown, version: number) => string;
export declare const decode: <T>(raw: string, version: number, migrate?: (saved: any, savedVersion: number) => Partial<T> | undefined) => {
    next: Partial<T>;
    migrated: boolean;
} | undefined;
export interface Hydration {
    hasHydrated: () => boolean;
    onHydrated: (cb: () => void) => () => void;
}
