import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { JoinLinkInfo } from '../api/endpoints/sharelinks'
import { sharelinksApi } from '../api/endpoints/sharelinks'
import { useAuth } from '../auth/AuthContext'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'

export function JoinLandingPage() {
  const { code = '' } = useParams<{ code: string }>()
  const { refetchMe, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [linkInfo, setLinkInfo] = useState<JoinLinkInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(['self'])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    sharelinksApi
      .resolve(code)
      .then((result) => {
        if (cancelled) {
          return
        }
        setLinkInfo(result)
        if (result.familySelectionNeeded === true) {
          setSelectedMemberIds(['self'])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [code])

  function toggleMember(memberId: string): void {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    )
  }

  async function handleFamilySelectionSubmit(): Promise<void> {
    // This screen only ever renders when the backend's GET /join/:code already
    // resolved an authenticated caller with existing family members
    // (`familySelectionNeeded`) — so this is always the existing-user
    // association branch, never a new registration. Sending blank
    // email/password/name here used to 400 at RegisterViaLinkDto's own field
    // validators (empty string fails @IsEmail()/@MinLength(), even though the
    // fields are optional-when-absent) before the request ever reached the
    // service's association logic. Omitting them entirely lets the backend
    // recognize the caller from the Authorization header apiClient already
    // attaches and take the associate-existing-user path instead of trying
    // to register a brand-new account.
    if (!isAuthenticated) {
      setErrorMessage('Please log in to connect your family with this trainer.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await sharelinksApi.registerViaLink(code, { associateMemberIds: selectedMemberIds })
      navigate('/', { replace: true })
    } catch {
      setErrorMessage('Unable to save your selection. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await sharelinksApi.registerViaLink(code, { email, password, firstName, lastName })
      // registerViaLink's response body still carries a (now-vestigial) token pair —
      // the session itself rides on the cookies the server set alongside it, so
      // re-derive identity from GET /auth/me rather than decoding anything client-side.
      await refetchMe()
      navigate('/', { replace: true })
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const body = error.response.data as { message?: string }
        setErrorMessage(body.message ?? 'Unable to complete registration.')
      } else {
        setErrorMessage('Unable to complete registration.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-12">
        <p className="text-body text-ink-soft">Loading…</p>
      </main>
    )
  }

  if (notFound || linkInfo === null) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 py-12 text-center">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Link Not Found</h1>
        <Banner variant="error">This invite link is no longer valid.</Banner>
      </main>
    )
  }

  if (linkInfo.blocked === true) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 py-12 text-center">
        <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">{linkInfo.trainerName}</h1>
        <Banner variant="info">Ask your parent to add this trainer for you.</Banner>
      </main>
    )
  }

  if (linkInfo.familySelectionNeeded === true) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-8 px-4 py-12">
        <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">{linkInfo.trainerName}</h1>
        {errorMessage !== null && <Banner variant="error">{errorMessage}</Banner>}
        <p className="text-body text-ink">Who would you like to connect with {linkInfo.trainerName}?</p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 text-body text-ink">
            <input type="checkbox" checked={selectedMemberIds.includes('self')} onChange={() => toggleMember('self')} />
            Self
          </label>
          {(linkInfo.familyMembers ?? []).map((member) => (
            <label key={member.id} className="flex items-center gap-3 text-body text-ink">
              <input
                type="checkbox"
                checked={selectedMemberIds.includes(member.id)}
                onChange={() => toggleMember(member.id)}
              />
              {member.name}
              {member.age !== undefined ? ` (${member.age})` : ''}
            </label>
          ))}
        </div>
        <Button onClick={() => void handleFamilySelectionSubmit()} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Confirm'}
        </Button>
      </main>
    )
  }

  if (isAuthenticated) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 py-12 text-center">
        <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">{linkInfo.trainerName}</h1>
        <p className="text-body text-ink-soft">You&apos;re already connected — nothing more to do here.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">{linkInfo.trainerName}</h1>

      {errorMessage !== null && <Banner variant="error">{errorMessage}</Banner>}

      <form onSubmit={(event) => void handleRegisterSubmit(event)} className="flex flex-col gap-4" noValidate>
        <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label="Password"
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Join'}
        </Button>
      </form>
    </main>
  )
}
