import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/endpoints/auth'
import { Banner } from '../components/ui/Banner'
import { StampBadge } from '../components/ui/StampBadge'

type VerifyStatus = 'verifying' | 'verified' | 'invalid'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState<VerifyStatus>('verifying')

  useEffect(() => {
    let cancelled = false
    authApi
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) {
          setStatus('verified')
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (isAxiosError(error)) {
          setStatus('invalid')
        } else {
          setStatus('invalid')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Email Verification</h1>

      {status === 'verifying' && <p className="text-body text-ink-soft">Verifying your email…</p>}

      {status === 'verified' && (
        <>
          <StampBadge label="Verified" variant="active" animate />
          <p className="text-body">Your email is verified. You can now sign in.</p>
          <Link to="/login" className="font-semibold text-cinder underline">
            Continue to sign in
          </Link>
        </>
      )}

      {status === 'invalid' && (
        <Banner variant="error">
          <p>This verification link is invalid or has expired.</p>
          <Link to="/login" className="mt-2 inline-block font-semibold underline">
            Request new link
          </Link>
        </Banner>
      )}
    </main>
  )
}
