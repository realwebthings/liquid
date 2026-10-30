export function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (
    !a || !b ||
    typeof a !== 'object' || typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false
  }
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is((a as any)[k], (b as any)[k]))
  )
}
