import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'

/** Sticky, full-width banner — the ONE place in the whole system `--color-alert`
 * appears, per frontend-design-spec.md. Mounts whenever `AuthContext`'s user state
 * (populated from `GET /auth/me`) carries an `impersonatedBy` claim; its Exit action
 * only ever clears the impersonation session (the second, independent cookie pair —
 * ADR-0006), never the admin's own. */
export function ImpersonationBanner() {
  const { user, isImpersonating, exitImpersonation } = useAuth()
  const [isExiting, setIsExiting] = useState(false)

  if (!isImpersonating || user === null) {
    return null
  }

  async function handleExit(): Promise<void> {
    setIsExiting(true)
    try {
      await exitImpersonation()
    } finally {
      setIsExiting(false)
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex w-full items-center justify-between border-b-4 border-alert-stripe bg-alert px-4 py-2 text-alert-ink"
    >
      <span className="font-display uppercase tracking-wide text-body">
        Viewing as {user.email} ({user.role})
      </span>
      <button
        type="button"
        onClick={() => void handleExit()}
        disabled={isExiting}
        className="rounded-sm border border-alert-ink px-3 py-1 font-semibold uppercase tracking-wide text-alert-ink disabled:opacity-60"
      >
        {isExiting ? 'Exiting…' : 'Exit Impersonation'}
      </button>
    </div>
  )
}
