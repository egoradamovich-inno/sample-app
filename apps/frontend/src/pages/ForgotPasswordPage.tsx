import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/endpoints/auth'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'

// Anti-enumeration (FR-004): this copy must read identically whether or not the
// email exists — never branch wording on the backend's actual finding.
const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password."

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await authApi.requestPasswordReset(email)
    } catch {
      // Deliberately swallowed: the success copy must never differ based on whether
      // the request actually found an account (or even succeeded at the network
      // level) — anything else risks leaking the anti-enumeration distinction.
    } finally {
      setIsSubmitting(false)
      setIsSubmitted(true)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
      <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Forgot Password</h1>

      {isSubmitted ? (
        <Banner variant="success">{GENERIC_SUCCESS_MESSAGE}</Banner>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}

      <p className="text-body">
        <Link to="/login" className="text-cinder underline">
          Back to sign in
        </Link>
      </p>
    </main>
  )
}
