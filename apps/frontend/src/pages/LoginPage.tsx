import { isAxiosError } from 'axios'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints/auth'
import { useAuth } from '../auth/AuthContext'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendErrorMessage, setResendErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorCode(null)
    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      const state = location.state as LocationState | null
      navigate(state?.from?.pathname ?? '/', { replace: true })
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const body = error.response.data as { errorCode?: string; message?: string }
        setErrorCode(body.errorCode ?? null)
        setErrorMessage(body.message ?? 'Unable to sign in.')
      } else {
        setErrorMessage('Unable to sign in.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend(): Promise<void> {
    setResendState('sending')
    setResendErrorMessage(null)
    try {
      await authApi.resendVerification(email)
      setResendState('sent')
    } catch {
      setResendState('idle')
      setResendErrorMessage('Unable to resend the verification email. Please try again.')
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
      <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">TRAINING PLATFORM</h1>

      {errorCode === 'EMAIL_NOT_VERIFIED' ? (
        <Banner variant="error">
          <p>Your email address hasn&apos;t been verified yet. Check your inbox for the verification link.</p>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resendState !== 'idle'}
            className="mt-2 font-semibold text-cinder underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-70"
          >
            {resendState === 'sending'
              ? 'Sending…'
              : resendState === 'sent'
                ? 'Verification email sent'
                : 'Resend verification email'}
          </button>
          {resendErrorMessage !== null && <p className="mt-2 text-body">{resendErrorMessage}</p>}
        </Banner>
      ) : errorMessage !== null ? (
        <Banner variant="error">{errorMessage}</Banner>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex justify-between text-body">
        <Link to="/forgot-password" className="text-cinder underline">
          Forgot password?
        </Link>
        <Link to="/register" className="text-cinder underline">
          Create account
        </Link>
      </div>
    </main>
  )
}
