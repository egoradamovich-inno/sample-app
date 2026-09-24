import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/endpoints/auth'
import { VerifyEmailPage } from './VerifyEmailPage'

vi.mock('../api/endpoints/auth', () => ({
  authApi: { verifyEmail: vi.fn() },
}))

function renderPage(initialEntry = '/verify-email?token=abc') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  )
}

describe('VerifyEmailPage', () => {
  it('should show a Roster Stamp VERIFIED badge on success', async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue(undefined)
    renderPage()
    expect(await screen.findByText('Verified')).toBeInTheDocument()
  })

  it('should show an expired/invalid state with a request-new-link action on failure', async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValue(
      Object.assign(new Error('bad token'), { isAxiosError: true, response: { data: {}, status: 400 } }),
    )
    renderPage()
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request new link/i })).toBeInTheDocument()
  })
})
