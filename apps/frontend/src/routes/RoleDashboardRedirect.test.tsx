import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Role } from '../types/api'
import { RoleDashboardRedirect } from './RoleDashboardRedirect'

const mockUseAuth = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithUser(user: { role: Role } | null) {
  mockUseAuth.mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RoleDashboardRedirect />} />
        <Route path="/admin/users" element={<div>Admin Users Page</div>} />
        <Route path="/trainer/roster" element={<div>Trainer Roster Page</div>} />
        <Route path="/coach/my-times" element={<div>Coach My Times Page</div>} />
        <Route path="/players" element={<div>Player Profiles Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoleDashboardRedirect', () => {
  it.each<[Role, string]>([
    ['SUPER_ADMIN', 'Admin Users Page'],
    ['TRAINER', 'Trainer Roster Page'],
    ['COACH', 'Coach My Times Page'],
    ['PLAYER', 'Player Profiles Page'],
  ])('should redirect %s to its own first substantive page', async (role, expectedText) => {
    renderWithUser({ role })
    expect(await screen.findByText(expectedText)).toBeInTheDocument()
  })

  it('should redirect to /login when there is no authenticated user', async () => {
    renderWithUser(null)
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })
})
