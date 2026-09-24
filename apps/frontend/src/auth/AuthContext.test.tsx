import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminImpersonationApi } from '../api/endpoints/admin-impersonation'
import { authApi } from '../api/endpoints/auth'
import type { AuthenticatedUser } from '../types/api'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../api/endpoints/auth', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
}))
vi.mock('../api/endpoints/admin-impersonation', () => ({
  adminImpersonationApi: { start: vi.fn(), exit: vi.fn() },
}))

const CHILD_ME: AuthenticatedUser = { userId: 'child-1', email: 'kid@x.com', role: 'PLAYER', parentUserId: 'parent-1' }
const IMPERSONATED_TRAINER_ME: AuthenticatedUser = {
  userId: 'trainer-1',
  email: 'trainer@x.com',
  role: 'TRAINER',
  parentUserId: null,
  impersonatedBy: 'admin-1',
}

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="is-child">{String(auth.isChildAccount)}</span>
      <button onClick={() => void auth.login('a@x.com', 'pw')}>login-admin</button>
      <button onClick={() => void auth.logout()}>logout</button>
      <button onClick={() => void auth.startImpersonation('trainer-1')}>start-impersonation</button>
      <button onClick={() => void auth.exitImpersonation()}>exit-impersonation</button>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthContext isChildAccount recomputation', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
    vi.mocked(authApi.logout).mockReset()
    vi.mocked(authApi.me).mockReset()
    vi.mocked(adminImpersonationApi.start).mockReset()
    vi.mocked(adminImpersonationApi.exit).mockReset()
  })

  it('should become true after logging in as a child account', async () => {
    // Mount-time /auth/me: no session yet. Post-login refetch: the child's identity.
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('401')).mockResolvedValue(CHILD_ME)
    vi.mocked(authApi.login).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('false'))

    await user.click(screen.getByText('login-admin'))

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('true'))
  })

  it('should reset to false on logout, even after a child session', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('401')).mockResolvedValue(CHILD_ME)
    vi.mocked(authApi.login).mockResolvedValue(undefined)
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('false'))
    await user.click(screen.getByText('login-admin'))
    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('true'))

    await user.click(screen.getByText('logout'))
    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('false'))
  })

  it('should flip false on startImpersonation even if isChildAccount was true from a prior (unrelated) session', async () => {
    // Mount resolves as an already-logged-in child account — the bug this guards
    // against is startImpersonation never updating isChildAccount afterwards, not
    // the initial read.
    vi.mocked(authApi.me).mockResolvedValueOnce(CHILD_ME).mockResolvedValueOnce(IMPERSONATED_TRAINER_ME)
    vi.mocked(adminImpersonationApi.start).mockResolvedValue({
      accessToken: 'irrelevant',
      refreshToken: 'irrelevant',
      startedAt: '2026-01-01T00:00:00.000Z',
      impersonatedUser: {
        id: 'trainer-1',
        name: 'Trainer',
        email: 'trainer@x.com',
        role: 'TRAINER',
        status: 'ACTIVE',
        lastLoginAt: null,
      },
    })
    const user = userEvent.setup()
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('true'))

    await user.click(screen.getByText('start-impersonation'))

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('false'))
  })

  it('should flip true on exitImpersonation when the restored identity is a child account', async () => {
    // Mount resolves as an active impersonation session; exiting refetches /auth/me
    // again, which — for this test — resolves as a child account. Isolates exactly
    // what exitImpersonation recomputes from: the freshly refetched identity, not a
    // leftover isImpersonating side effect.
    vi.mocked(authApi.me).mockResolvedValueOnce(IMPERSONATED_TRAINER_ME).mockResolvedValueOnce(CHILD_ME)
    vi.mocked(adminImpersonationApi.exit).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderProbe()

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('false'))

    await user.click(screen.getByText('exit-impersonation'))

    await waitFor(() => expect(screen.getByTestId('is-child')).toHaveTextContent('true'))
  })
})
