import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/endpoints/auth'
import { ResetPasswordPage } from './ResetPasswordPage'

vi.mock('../api/endpoints/auth', () => ({
  authApi: { confirmPasswordReset: vi.fn() },
}))

function renderPage(initialEntry = '/reset-password?token=abc') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage', () => {
  it('should show an actionable expired-token message with a link back to request a new one', async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValue(
      Object.assign(new Error('bad token'), {
        isAxiosError: true,
        response: { data: { errorCode: 'PASSWORD_RESET_TOKEN_EXPIRED' }, status: 400 },
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/new password/i), 'NewPassw0rd!')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password')
  })

  it('should show a success message on a valid token', async () => {
    vi.mocked(authApi.confirmPasswordReset).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/new password/i), 'NewPassw0rd!')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    expect(await screen.findByText(/password has been reset/i)).toBeInTheDocument()
  })
})
