import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'
import { authApi } from '../api/endpoints/auth'

vi.mock('../api/endpoints/auth', () => ({
  authApi: { register: vi.fn() },
}))

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'New')
  await user.type(screen.getByLabelText(/last name/i), 'User')
  await user.type(screen.getByLabelText(/^email$/i), 'new@x.com')
  await user.type(screen.getByLabelText(/^password$/i), 'Passw0rd!')
  await user.click(screen.getByRole('button', { name: /create account/i }))
}

describe('RegisterPage', () => {
  it('should show a verify-your-email success message instead of navigating into the app', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      id: 'user-1',
      email: 'new@x.com',
      emailVerified: false,
    })
    const user = userEvent.setup()
    renderRegisterPage()

    await fillAndSubmit(user)

    await waitFor(() => {
      expect(screen.getByText(/verification link/i)).toBeInTheDocument()
    })
    expect(screen.getByText('new@x.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute('href', '/login')
  })

  it('should show a duplicate-email error without leaving the form', async () => {
    vi.mocked(authApi.register).mockRejectedValue({
      isAxiosError: true,
      response: { data: { errorCode: 'DUPLICATE_EMAIL' } },
    })
    const user = userEvent.setup()
    renderRegisterPage()

    await fillAndSubmit(user)

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('should hide the child sub-form by default', () => {
    renderRegisterPage()

    expect(screen.queryByLabelText(/child's name/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/child's birth date/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/child's gender/i)).not.toBeInTheDocument()
  })

  it('should reveal the child sub-form when "I\'m registering my child too" is toggled', async () => {
    const user = userEvent.setup()
    renderRegisterPage()

    await user.click(screen.getByRole('switch', { name: /registering my child too/i }))

    expect(screen.getByLabelText(/child's name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/child's birth date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/child's gender/i)).toBeInTheDocument()
  })

  it("should include the child's fields in the submitted payload when the toggle is on and filled in", async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      id: 'user-1',
      email: 'new@x.com',
      emailVerified: false,
    })
    const user = userEvent.setup()
    renderRegisterPage()

    await user.click(screen.getByRole('switch', { name: /registering my child too/i }))
    await user.type(screen.getByLabelText(/child's name/i), 'Kid One')
    await user.type(screen.getByLabelText(/child's birth date/i), '2018-05-01')
    await user.type(screen.getByLabelText(/child's gender/i), 'Female')

    await fillAndSubmit(user)

    await waitFor(() => expect(authApi.register).toHaveBeenCalled())
    expect(authApi.register).toHaveBeenCalledWith(
      expect.objectContaining({
        child: { displayName: 'Kid One', birthDate: '2018-05-01', gender: 'Female' },
      }),
    )
  })

  it('should not include a child object when the toggle stays off', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      id: 'user-1',
      email: 'new@x.com',
      emailVerified: false,
    })
    const user = userEvent.setup()
    renderRegisterPage()

    await fillAndSubmit(user)

    await waitFor(() => expect(authApi.register).toHaveBeenCalled())
    expect(authApi.register).toHaveBeenCalledWith(expect.objectContaining({ child: undefined }))
  })

  it('should wire an optional ShareLink code from the URL query string into the submission', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      id: 'user-1',
      email: 'new@x.com',
      emailVerified: false,
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/register?code=ABC123']}>
        <RegisterPage />
      </MemoryRouter>,
    )

    await fillAndSubmit(user)

    await waitFor(() => expect(authApi.register).toHaveBeenCalled())
    expect(authApi.register).toHaveBeenCalledWith(expect.objectContaining({ shareLinkCode: 'ABC123' }))
  })
})
