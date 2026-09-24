import { isAxiosError } from 'axios'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/endpoints/auth'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { StampBadge } from '../components/ui/StampBadge'
import { Switch } from '../components/ui/Switch'
import { TextField } from '../components/ui/TextField'

export function RegisterPage() {
  const [searchParams] = useSearchParams()
  // ShareLink code, when this registration was reached via an invite link that
  // fell back to the standalone form (e.g. `/register?code=...`) — matching
  // how JoinLandingPage resolves its own `code` param, just from the query
  // string here since this route carries no path param of its own.
  const shareLinkCode = searchParams.get('code') ?? undefined

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const [isRegisteringChild, setIsRegisteringChild] = useState(false)
  const [childDisplayName, setChildDisplayName] = useState('')
  const [childBirthDate, setChildBirthDate] = useState('')
  const [childGender, setChildGender] = useState('')

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      // /auth/register never returns tokens — email verification is
      // required before login, so there is no session to establish here.
      const registered = await authApi.register({
        email,
        password,
        firstName,
        lastName,
        phone: phone || undefined,
        shareLinkCode,
        child:
          isRegisteringChild && childDisplayName && childBirthDate && childGender
            ? { displayName: childDisplayName, birthDate: childBirthDate, gender: childGender }
            : undefined,
      })
      setRegisteredEmail(registered.email)
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const body = error.response.data as { errorCode?: string; message?: string }
        if (body.errorCode === 'DUPLICATE_EMAIL') {
          setErrorMessage('An account with this email already exists.')
        } else {
          setErrorMessage(body.message ?? 'Unable to create your account.')
        }
      } else {
        setErrorMessage('Unable to create your account.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (registeredEmail !== null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Almost there</h1>
        <StampBadge label="Registered" variant="active" animate />
        <p className="text-body">
          We&apos;ve sent a verification link to <strong>{registeredEmail}</strong>. Confirm your email, then sign in
          to finish setting up your account.
        </p>
        <Link to="/login" className="font-semibold text-cinder underline">
          Continue to sign in
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
      <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">Create Account</h1>

      {errorMessage !== null && <Banner variant="error">{errorMessage}</Banner>}

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
        <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <Switch
          id="register-child-toggle"
          label="I'm registering my child too"
          checked={isRegisteringChild}
          onChange={setIsRegisteringChild}
        />

        {isRegisteringChild && (
          <div className="flex flex-col gap-4 motion-safe:animate-[field-reveal-open_150ms_ease-out] motion-reduce:animate-none">
            <TextField
              label="Child's name"
              required
              value={childDisplayName}
              onChange={(e) => setChildDisplayName(e.target.value)}
            />
            <TextField
              label="Child's birth date"
              type="date"
              required
              value={childBirthDate}
              onChange={(e) => setChildBirthDate(e.target.value)}
            />
            <TextField
              label="Child's gender"
              required
              value={childGender}
              onChange={(e) => setChildGender(e.target.value)}
            />
          </div>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-body">
        Already have an account?{' '}
        <Link to="/login" className="text-cinder underline">
          Sign in
        </Link>
      </p>
    </main>
  )
}
