import { isAxiosError } from 'axios'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/endpoints/auth'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'expired' | 'error'>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await authApi.confirmPasswordReset(token, newPassword)
      setStatus('success')
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const body = error.response.data as { errorCode?: string }
        if (body.errorCode === 'PASSWORD_RESET_TOKEN_EXPIRED' || body.errorCode === 'PASSWORD_RESET_TOKEN_INVALID') {
          setStatus('expired')
        } else {
          setStatus('error')
        }
      } else {
        setStatus('error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'success') {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Password Reset</h1>
        <Banner variant="success">Your password has been reset. You can now sign in.</Banner>
        <Link to="/login" className="text-cinder underline">
          Back to sign in
        </Link>
      </main>
    )
  }

  if (status === 'expired') {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Password Reset</h1>
        <Banner variant="error">
          This reset link has expired or was already used.{' '}
          <Link to="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
          .
        </Banner>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
      <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Reset Password</h1>

      {status === 'error' && <Banner variant="error">Something went wrong. Please try again.</Banner>}

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </main>
  )
}
