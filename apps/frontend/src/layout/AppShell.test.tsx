import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

const mockUseAuth = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))
vi.mock('./BrandingProvider', () => ({
  BrandingProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="branding-scope">{children}</div>,
  useBranding: () => ({ branding: null, refetch: vi.fn() }),
}))
vi.mock('../nav/ContextSwitcher', () => ({
  ContextSwitcher: () => <div>context-switcher-stub</div>,
}))
vi.mock('../pages/admin/ImpersonationBanner', () => ({
  ImpersonationBanner: () => null,
}))

describe('AppShell', () => {
  it('should render the header above the routed page content, both inside the branding scope', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Tom Trainer', email: 't@example.com', role: 'TRAINER', status: 'ACTIVE', lastLoginAt: null },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/trainer/roster']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/trainer/roster" element={<div>Roster Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const scope = screen.getByTestId('branding-scope')
    expect(scope).toContainElement(screen.getByRole('link', { name: 'Roster' }))
    expect(scope).toContainElement(screen.getByText('Roster Page Content'))
  })
})
