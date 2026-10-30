'use client'
import { createStoreContext } from 'liquid'

type S = { n: number; inc: () => void }
const Local = createStoreContext<S>()

function Inner({ label }: { label: string }) {
  const n = Local.useStore((s) => s.n)
  const inc = Local.useStore((s) => s.inc)
  return <button onClick={inc}>{label}: {n}</button>
}

export function LocalCounter({ label }: { label: string }) {
  return (
    <Local.Provider init={(set) => ({ n: 0, inc: () => set((s) => ({ n: s.n + 1 })) })}>
      <Inner label={label} />
    </Local.Provider>
  )
}
