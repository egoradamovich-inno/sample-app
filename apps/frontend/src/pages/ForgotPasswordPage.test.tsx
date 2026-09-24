import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/endpoints/auth'
import { ForgotPasswordPage } from './ForgotPasswordPage'

vi.mock('../api/endpoints/auth', () => ({
  authApi: { requestPasswordReset: vi.fn() },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  it('should show the generic success copy when the email exists', async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'exists@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument()
  })

  it('should show the identical success copy even when the request fails (anti-enumeration)', async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/email/i), 'unknown@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument()
  })
})
