import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminImpersonationApi } from '../../api/endpoints/admin-impersonation'
import { authApi } from '../../api/endpoints/auth'
import { AuthProvider, useAuth } from '../../auth/AuthContext'
import { ImpersonationBanner } from './ImpersonationBanner'

vi.mock('../../api/endpoints/auth', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
}))
vi.mock('../../api/endpoints/admin-impersonation', () => ({
  adminImpersonationApi: {
    start: vi.fn(),
    exit: vi.fn(),
    history: vi.fn(),
  },
}))

const ADMIN_ME = { userId: 'admin-1', email: 'ann@example.com', role: 'SUPER_ADMIN' as const, parentUserId: null }
const IMPERSONATED_ME = {
  userId: 'target-1',
  email: 'tom@example.com',
  role: 'TRAINER' as const,
  parentUserId: null,
  impersonatedBy: 'admin-1',
}
const TARGET_USER = { id: 'target-1', name: 'Tom Trainer', email: 'tom@example.com', role: 'TRAINER', status: 'ACTIVE', lastLoginAt: null }

function Harness() {
  const { startImpersonation, user } = useAuth()
  return (
    <div>
      <span data-testid="current-role">{user?.role ?? 'none'}</span>
      <button onClick={() => void startImpersonation('target-1')}>start-impersonation</button>
      <ImpersonationBanner />
    </div>
  )
}

function renderHarness() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  )
}

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset()
    vi.mocked(adminImpersonationApi.start).mockReset()
    vi.mocked(adminImpersonationApi.exit).mockReset()
  })

  it('should not render while there is no impersonation session active', async () => {
    vi.mocked(authApi.me).mockResolvedValue(ADMIN_ME)
    renderHarness()

    await waitFor(() => expect(screen.getByTestId('current-role')).toHaveTextContent('SUPER_ADMIN'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('should render once impersonation starts, and Exit restores the admin identity (never the target\'s own session)', async () => {
    // Mount: admin's own session. After start(): AuthContext.refetchMe() re-derives
    // identity from the (independent) impersonation cookie pair the server just set.
    // After exit(): refetchMe() again — back to the admin, since the admin's own
    // access_token/refresh_token cookies were never touched by start().
    vi.mocked(authApi.me).mockResolvedValueOnce(ADMIN_ME).mockResolvedValueOnce(IMPERSONATED_ME).mockResolvedValueOnce(ADMIN_ME)
    vi.mocked(adminImpersonationApi.start).mockResolvedValue({
      impersonatedUser: TARGET_USER as never,
      startedAt: new Date().toISOString(),
      accessToken: 'irrelevant-vestigial-token',
      refreshToken: 'irrelevant-vestigial-token',
    })
    vi.mocked(adminImpersonationApi.exit).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderHarness()

    await waitFor(() => expect(screen.getByTestId('current-role')).toHaveTextContent('SUPER_ADMIN'))

    await user.click(screen.getByText('start-impersonation'))

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/viewing as tom@example\.com \(trainer\)/i)
    expect(screen.getByTestId('current-role')).toHaveTextContent('TRAINER')

    await user.click(screen.getByRole('button', { name: /exit impersonation/i }))

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(adminImpersonationApi.exit).toHaveBeenCalledTimes(1)
    // The correct (admin) identity is restored — never left showing the target's role.
    expect(screen.getByTestId('current-role')).toHaveTextContent('SUPER_ADMIN')
  })
})
