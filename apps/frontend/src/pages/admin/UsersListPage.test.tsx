import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminUsersApi } from '../../api/endpoints/admin-users'
import { authApi } from '../../api/endpoints/auth'
import { AuthProvider } from '../../auth/AuthContext'
import type { UserSummary } from '../../types/api'
import { UsersListPage } from './UsersListPage'

vi.mock('../../api/endpoints/admin-users', () => ({
  adminUsersApi: {
    list: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../api/endpoints/admin-impersonation', () => ({
  adminImpersonationApi: { start: vi.fn(), exit: vi.fn(), history: vi.fn() },
}))

vi.mock('../../api/endpoints/auth', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
}))

const ACTIVE_USER: UserSummary = {
  id: 'u1',
  name: 'Tom Trainer',
  email: 'tom@example.com',
  role: 'TRAINER',
  status: 'ACTIVE',
  lastLoginAt: null,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <UsersListPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('UsersListPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(adminUsersApi.list).mockReset().mockResolvedValue({ items: [ACTIVE_USER], total: 1, page: 1, pageSize: 20 })
    vi.mocked(adminUsersApi.deactivate).mockReset()
    vi.mocked(adminUsersApi.reactivate).mockReset()
    vi.mocked(adminUsersApi.remove).mockReset()
    vi.mocked(adminUsersApi.create).mockReset()
    // This page only reads `startImpersonation` off useAuth, never `user` — the
    // mount-time /auth/me identity doesn't matter to any assertion here, it just
    // needs to resolve so AuthProvider settles out of isInitializing.
    vi.mocked(authApi.me).mockReset().mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'SUPER_ADMIN', parentUserId: null })
  })

  it('should list users in the ledger table', async () => {
    renderPage()
    expect(await screen.findByText('Tom Trainer')).toBeInTheDocument()
    expect(screen.getByText('tom@example.com')).toBeInTheDocument()
  })

  it('should show the login-blocking warning copy and call deactivate on confirm', async () => {
    vi.mocked(adminUsersApi.deactivate).mockResolvedValue({ ...ACTIVE_USER, status: 'INACTIVE' })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tom Trainer')
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/blocked from logging in/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(adminUsersApi.deactivate).toHaveBeenCalledWith('u1'))
  })

  it('should show the irreversible-anonymization warning copy and call delete on confirm', async () => {
    vi.mocked(adminUsersApi.remove).mockResolvedValue({ ...ACTIVE_USER, name: 'Deleted User', status: 'DELETED' })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tom Trainer')
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/anonymizes/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /delete permanently/i }))

    await waitFor(() => expect(adminUsersApi.remove).toHaveBeenCalledWith('u1'))
  })

  it('should send an invite when the create-trainer form is submitted', async () => {
    vi.mocked(adminUsersApi.create).mockResolvedValue({ ...ACTIVE_USER, id: 'u2' })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tom Trainer')
    await user.click(screen.getByRole('button', { name: /create trainer/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/business name/i), 'Acme Sports')
    await user.type(within(dialog).getByLabelText(/first name/i), 'Nina')
    await user.type(within(dialog).getByLabelText(/last name/i), 'New')
    await user.type(within(dialog).getByLabelText(/email/i), 'nina@example.com')
    await user.click(within(dialog).getByRole('button', { name: /send invite/i }))

    await waitFor(() =>
      expect(adminUsersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessName: 'Acme Sports', firstName: 'Nina', lastName: 'New', email: 'nina@example.com' }),
      ),
    )
  })
})
