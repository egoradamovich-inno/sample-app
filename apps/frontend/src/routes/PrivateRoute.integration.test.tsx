import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/endpoints/auth'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from '../pages/LoginPage'
import { PrivateRoute } from './PrivateRoute'

vi.mock('../api/endpoints/auth', () => ({
  authApi: { login: vi.fn(), resendVerification: vi.fn(), me: vi.fn() },
}))

describe('PrivateRoute + LoginPage integration', () => {
  it('should preserve the originally-requested destination and land there after login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(undefined)
    // Initial mount: no session yet (unauthenticated visit). After login: the
    // freshly-established session, resolved via the same GET /auth/me refetch
    // login() triggers instead of reading tokens off the login response body.
    vi.mocked(authApi.me)
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValue({ userId: '1', email: 'ann@example.com', role: 'SUPER_ADMIN', parentUserId: null })

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<PrivateRoute />}>
              <Route path="/admin/users" element={<div>Admin Users Page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    // Unauthenticated visit to the private route redirected to /login.
    expect(await screen.findByRole('heading', { name: /training platform/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/email/i), 'ann@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Admin Users Page')).toBeInTheDocument()
  })
})
