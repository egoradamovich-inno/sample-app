import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authApi } from './api/endpoints/auth'
import App from './App'

vi.mock('./api/endpoints/auth', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), resendVerification: vi.fn(), me: vi.fn() },
}))

describe('App', () => {
  it('should redirect an unauthenticated visitor to the login page, which renders the platform wordmark', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))
    render(<App />)
    expect(await screen.findByText('TRAINING PLATFORM')).toBeInTheDocument()
  })
})
