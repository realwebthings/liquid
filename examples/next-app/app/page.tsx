import { AsyncCounter } from '../components/async-counter'
import { GlobalCounter, GlobalCounterMirror } from '../components/global-counter'
import { LocalCounter } from '../components/local-counter'
import { Profile } from '../components/profile'
import { UserProvider } from '../components/user-provider'

// dynamic: reads searchParams, so it renders per request
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>
}) {
  const { user = 'guest' } = await searchParams
  return (
    <main>
      <h1>lightmight demo</h1>
      <UserProvider user={user}>
        <Profile />
      </UserProvider>
      <p>
        <GlobalCounter />
        <GlobalCounterMirror />
      </p>
      <p>
        <AsyncCounter />
      </p>
      <p>
        <LocalCounter label="local A" /> <LocalCounter label="local B" />
      </p>
    </main>
  )
}
