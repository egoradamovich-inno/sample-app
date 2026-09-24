import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { sharelinksApi } from '../api/endpoints/sharelinks'
import { JoinLandingPage } from './JoinLandingPage'

vi.mock('../api/endpoints/sharelinks', () => ({
  sharelinksApi: {
    generateStatic: vi.fn(),
    generateCoachInvite: vi.fn(),
    listCoachInvites: vi.fn(),
    resendCoachInvite: vi.fn(),
    resolve: vi.fn(),
    registerViaLink: vi.fn(),
  },
}))

const mockUseAuth = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderAtCode(code = 'ABC123', isAuthenticated = false) {
  mockUseAuth.mockReturnValue({ refetchMe: vi.fn(), isAuthenticated })
  return render(
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<JoinLandingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinLandingPage', () => {
  it('should show the family-selection checklist with Self pre-checked when the API signals it', async () => {
    vi.mocked(sharelinksApi.resolve).mockResolvedValue({
      trainerName: 'Acme Sports',
      linkType: 'STATIC',
      familySelectionNeeded: true,
      familyMembers: [{ id: 'child-1', name: 'Kid One', age: 9 }],
    })

    renderAtCode('ABC123', true)

    expect(await screen.findByText('Acme Sports')).toBeInTheDocument()
    const selfCheckbox = screen.getByLabelText('Self') as HTMLInputElement
    expect(selfCheckbox.checked).toBe(true)
    expect(screen.getByText(/kid one \(9\)/i)).toBeInTheDocument()
  })

  it('should show the "ask your parent" message for a blocked child session, never a registration form', async () => {
    vi.mocked(sharelinksApi.resolve).mockResolvedValue({
      trainerName: 'Acme Sports',
      linkType: 'STATIC',
      blocked: true,
    })

    renderAtCode('ABC123', true)

    expect(await screen.findByText(/ask your parent/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^join$/i })).not.toBeInTheDocument()
  })

  it('should show the registration form for a new, unauthenticated visitor', async () => {
    vi.mocked(sharelinksApi.resolve).mockResolvedValue({
      trainerName: 'Acme Sports',
      linkType: 'STATIC',
    })

    renderAtCode('ABC123', false)

    expect(await screen.findByRole('button', { name: /^join$/i })).toBeInTheDocument()
  })

  it('should call the association endpoint with only the selected member ids for a logged-in multi-trainer parent, never blank registration credentials', async () => {
    vi.mocked(sharelinksApi.resolve).mockResolvedValue({
      trainerName: 'Acme Sports',
      linkType: 'STATIC',
      familySelectionNeeded: true,
      familyMembers: [
        { id: 'child-1', name: 'Kid One', age: 9 },
        { id: 'child-2', name: 'Kid Two', age: 12 },
      ],
    })
    vi.mocked(sharelinksApi.registerViaLink).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })

    const user = userEvent.setup()
    renderAtCode('ABC123', true)

    expect(await screen.findByText('Acme Sports')).toBeInTheDocument()
    // Deselect "Self", keep only one child selected — a real subset choice,
    // not the default-everyone-checked state.
    await user.click(screen.getByLabelText('Self'))
    await user.click(screen.getByLabelText(/kid one/i))

    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => expect(sharelinksApi.registerViaLink).toHaveBeenCalled())
    expect(sharelinksApi.registerViaLink).toHaveBeenCalledWith('ABC123', { associateMemberIds: ['child-1'] })
    const payload = vi.mocked(sharelinksApi.registerViaLink).mock.calls[0][1]
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('password')
  })

  it('should re-derive the session from GET /auth/me after registering, not decode the (vestigial) response tokens', async () => {
    vi.mocked(sharelinksApi.resolve).mockResolvedValue({
      trainerName: 'Acme Sports',
      linkType: 'STATIC',
    })
    vi.mocked(sharelinksApi.registerViaLink).mockResolvedValue({
      accessToken: 'irrelevant-vestigial-token',
      refreshToken: 'irrelevant-vestigial-token',
    })
    const refetchMe = vi.fn().mockResolvedValue({ userId: 'new-user-1', email: 'new@x.com', role: 'PLAYER', parentUserId: null })
    mockUseAuth.mockReturnValue({ refetchMe, isAuthenticated: false })

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/join/ABC123']}>
        <Routes>
          <Route path="/join/:code" element={<JoinLandingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(await screen.findByLabelText(/first name/i), 'New')
    await user.type(screen.getByLabelText(/last name/i), 'Player')
    await user.type(screen.getByLabelText(/email/i), 'new@x.com')
    await user.type(screen.getByLabelText(/password/i), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: /^join$/i }))

    await waitFor(() => expect(refetchMe).toHaveBeenCalledTimes(1))
    expect(sharelinksApi.registerViaLink).toHaveBeenCalledWith('ABC123', {
      email: 'new@x.com',
      password: 'Passw0rd!',
      firstName: 'New',
      lastName: 'Player',
    })
  })
})
