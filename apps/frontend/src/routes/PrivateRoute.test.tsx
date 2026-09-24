import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PrivateRoute } from './PrivateRoute'

const mockUseAuth = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderApp(user: { role: string } | null, isInitializing: boolean, initialEntry: string) {
  mockUseAuth.mockReturnValue({ user, isInitializing })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<PrivateRoute />}>
          <Route path="/admin/users" element={<div>Admin Users Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PrivateRoute', () => {
  it('should render nothing while the initial /auth/me check is in flight', () => {
    renderApp(null, true, '/admin/users')
    expect(screen.queryByText('Admin Users Page')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('should render the nested route when authenticated', async () => {
    renderApp({ role: 'SUPER_ADMIN' }, false, '/admin/users')
    expect(await screen.findByText('Admin Users Page')).toBeInTheDocument()
  })

  it('should redirect an unauthenticated visit to /login once the auth check has settled', async () => {
    renderApp(null, false, '/admin/users')
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })
})
