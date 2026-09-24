import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/endpoints/auth'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

vi.mock('../api/endpoints/auth', () => ({
  authApi: {
    login: vi.fn(),
    resendVerification: vi.fn(),
    me: vi.fn(),
  },
}))

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
    vi.mocked(authApi.resendVerification).mockReset()
    // No session on mount for any of these tests — none of them exercise a
    // successful login through to the post-login state.
    vi.mocked(authApi.me).mockReset().mockRejectedValue(new Error('401'))
  })

  it('should show a distinct EMAIL_NOT_VERIFIED banner with a resend action, not a generic field error', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.login).mockRejectedValue(
      Object.assign(new Error('forbidden'), {
        isAxiosError: true,
        response: { data: { errorCode: 'EMAIL_NOT_VERIFIED', message: 'blocked' }, status: 403 },
      }),
    )
    vi.mocked(authApi.resendVerification).mockResolvedValue(undefined)

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'parent@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent(/hasn.t been verified/i)

    const resendButton = screen.getByRole('button', { name: /resend verification email/i })
    await user.click(resendButton)

    await waitFor(() => expect(authApi.resendVerification).toHaveBeenCalledWith('parent@example.com'))
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument()
  })

  it('should surface a resend failure instead of falsely claiming success', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.login).mockRejectedValue(
      Object.assign(new Error('forbidden'), {
        isAxiosError: true,
        response: { data: { errorCode: 'EMAIL_NOT_VERIFIED', message: 'blocked' }, status: 403 },
      }),
    )
    vi.mocked(authApi.resendVerification).mockRejectedValue(new Error('network error'))

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'parent@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const resendButton = await screen.findByRole('button', { name: /resend verification email/i })
    await user.click(resendButton)

    expect(await screen.findByText(/unable to resend/i)).toBeInTheDocument()
    expect(screen.queryByText(/verification email sent/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend verification email/i })).not.toBeDisabled()
  })

  it('should show a generic error banner for invalid credentials, never the verification banner', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.login).mockRejectedValue(
      Object.assign(new Error('unauthorized'), {
        isAxiosError: true,
        response: { data: { errorCode: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, status: 401 },
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'parent@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Invalid email or password')
    expect(screen.queryByRole('button', { name: /resend verification email/i })).not.toBeInTheDocument()
  })

  it('should be operable via keyboard alone (tab to fields and submit button)', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.tab()
    expect(screen.getByLabelText(/email/i)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/password/i)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus()
  })
})
