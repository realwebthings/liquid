import { createStoreContext } from 'lightmight'

export type UserState = {
  user: string
  setUser: (user: string) => void
}

export const UserCtx = createStoreContext<UserState>()
