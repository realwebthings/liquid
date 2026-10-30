import { act, render, renderHook, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { create } from './create'
import { createStoreContext } from './context'

type S = { user: string | null; setUser: (u: string) => void }
const init = (user: string | null) => (set: (p: Partial<S>) => void) => ({
  user,
  setUser: (u: string) => set({ user: u }),
})

function Show({ use }: { use: () => string | null }) {
  return <p>{String(use())}</p>
}

describe('SSR: singleton problems', () => {
  it('singleton leaks state to next request via getState', () => {
    const useUser = create<S>(init(null))
    useUser.setState({ user: 'alice' }) // request 1 writes
    expect(useUser.getState().user).toBe('alice') // request 2 reads alice
  })

  it('singleton cannot seed per-request data into SSR output', () => {
    const useUser = create<S>(init(null))
    useUser.setState({ user: 'alice' })
    const html = renderToString(<Show use={() => useUser((s) => s.user)} />)
    expect(html).toContain('null') // server snapshot = frozen initial state
  })
})

describe('createStoreContext', () => {
  it('per-request store: each render seeded independently', () => {
    const { Provider, useStore } = createStoreContext<S>()
    const page = (u: string) =>
      renderToString(
        <Provider init={init(u)}>
          <Show use={() => useStore((s) => s.user)} />
        </Provider>,
      )
    expect(page('alice')).toContain('alice')
    expect(page('bob')).toContain('bob')
  })

  it('updates re-render inside Provider', () => {
    const { Provider, useStore } = createStoreContext<S>()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider init={init('a')}>{children}</Provider>
    )
    const { result } = renderHook(() => useStore(), { wrapper })
    act(() => result.current.setUser('b'))
    expect(result.current.user).toBe('b')
  })

  it('throws outside Provider', () => {
    const { useStore } = createStoreContext<S>()
    expect(() => renderHook(() => useStore())).toThrow(/Provider/)
  })

  it('sibling Providers are isolated (local state)', () => {
    const { Provider, useStore } = createStoreContext<S>()
    function Btn({ id }: { id: string }) {
      const user = useStore((s) => s.user)
      const setUser = useStore((s) => s.setUser)
      return <button data-testid={id} onClick={() => setUser('x')}>{user}</button>
    }
    render(
      <>
        <Provider init={init('a')}><Btn id="one" /></Provider>
        <Provider init={init('b')}><Btn id="two" /></Provider>
      </>,
    )
    act(() => screen.getByTestId('one').click())
    expect(screen.getByTestId('one').textContent).toBe('x')
    expect(screen.getByTestId('two').textContent).toBe('b')
  })
})

describe('useStoreApi', () => {
  it('gives write access without subscribing (no re-render)', () => {
    const { Provider, useStoreApi } = createStoreContext<S>()
    let renders = 0
    let api!: ReturnType<typeof useStoreApi>
    function Writer() {
      renders++
      api = useStoreApi()
      return null
    }
    render(<Provider init={init('a')}><Writer /></Provider>)
    const before = renders
    act(() => api.setState({ user: 'b' }))
    expect(api.getState().user).toBe('b')
    expect(renders).toBe(before)
  })
})
