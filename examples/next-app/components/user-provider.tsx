'use client'
import type { ReactNode } from 'react'
import { UserCtx } from '../lib/user-store'

// Server components can't pass functions to client components,
// so this client wrapper builds the `init` function from plain data.
export function UserProvider({ user, children }: { user: string; children: ReactNode }) {
  return (
    <UserCtx.Provider init={(set) => ({ user, setUser: (u) => set({ user: u }) })}>
      {children}
    </UserCtx.Provider>
  )
}
