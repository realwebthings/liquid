'use client'
import { UserCtx } from '../lib/user-store'

export function Profile() {
  const user = UserCtx.useStore((s) => s.user)
  const setUser = UserCtx.useStore((s) => s.setUser)
  return (
    <p>
      user: <b data-testid="user">{user}</b>{' '}
      <button onClick={() => setUser(user + '!')}>shout</button>
    </p>
  )
}
