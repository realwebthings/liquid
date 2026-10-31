// Shared by `lightmight/persist` (sync) and `lightmight/persist-async`. Not a public entry.
export const encode = (state: unknown, version: number) =>
  JSON.stringify({ state, version })

export const decode = <T>(
  raw: string,
  version: number,
  migrate?: (saved: any, savedVersion: number) => Partial<T> | undefined,
) => {
  const { state, version: v } = JSON.parse(raw)
  const next = v === version ? state : migrate?.(state, v)
  return next ? { next: next as Partial<T>, migrated: v !== version } : undefined
}

export interface Hydration {
  hasHydrated: () => boolean
  onHydrated: (cb: () => void) => () => void
}
