import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader } from './AppHeader'

const mockUseAuth = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))
vi.mock('./BrandingProvider', () => ({
  useBranding: () => ({ branding: null, refetch: vi.fn() }),
}))
vi.mock('../nav/ContextSwitcher', () => ({
  ContextSwitcher: () => <div>context-switcher-stub</div>,
}))
vi.mock('../pages/admin/ImpersonationBanner', () => ({
  ImpersonationBanner: () => null,
}))

function renderHeader() {
  return render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>,
  )
}

describe('AppHeader', () => {
  it("should show the caller's role-specific nav links", () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Tom Trainer', email: 't@example.com', role: 'TRAINER', status: 'ACTIVE', lastLoginAt: null },
      logout: vi.fn(),
    })

    renderHeader()

    expect(screen.getByRole('link', { name: 'Roster' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Branding' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('should call logout when Log out is clicked', async () => {
    const logout = vi.fn()
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Pat Player', email: 'p@example.com', role: 'PLAYER', status: 'ACTIVE', lastLoginAt: null },
      logout,
    })
    const user = userEvent.setup()

    renderHeader()
    await user.click(screen.getByRole('button', { name: /log out/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })
})
