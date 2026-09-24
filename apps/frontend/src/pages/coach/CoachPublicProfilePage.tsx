import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicCoachProfile } from '../../api/endpoints/coach'
import { coachApi } from '../../api/endpoints/coach'

// Matches the backend's uniform-404 anti-enumeration contract (GET /coach/public/:slug):
// not-found, not-public, and deactivated all render this SAME copy — the UI must never
// editorialize a distinction the backend deliberately doesn't expose.
const NOT_FOUND_MESSAGE = "This coach profile isn't available."

/** Deliberately outside the authenticated app shell — no AppHeader, no
 * ContextSwitcher. A real standalone public page. */
export function CoachPublicProfilePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [profile, setProfile] = useState<PublicCoachProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    coachApi
      .getPublicProfile(slug)
      .then((result) => {
        if (!cancelled) {
          setProfile(result)
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
  }, [slug])

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-body text-ink-soft">Loading…</p>
      </main>
    )
  }

  if (notFound || profile === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Not Found</h1>
        <p className="mt-4 text-body text-ink-soft">{NOT_FOUND_MESSAGE}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-display text-display-xl uppercase tracking-tight text-ink">{profile.name}</h1>
      {profile.bio !== null && profile.bio !== undefined && <p className="mt-6 text-body text-ink">{profile.bio}</p>}
      {profile.credentials !== null && profile.credentials !== undefined && (
        <p className="mt-4 text-body text-ink-soft">{profile.credentials}</p>
      )}
      {profile.certifications.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {profile.certifications.map((certification) => (
            <li key={certification} className="rounded-sm border border-rule-strong px-2 py-1 text-label uppercase tracking-wide text-ink-soft">
              {certification}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
