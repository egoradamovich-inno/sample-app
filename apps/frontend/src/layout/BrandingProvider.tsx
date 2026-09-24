import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX, ReactNode } from 'react'
import type { Branding } from '../api/endpoints/branding'
import { brandingApi } from '../api/endpoints/branding'
import { useActiveContext } from '../nav/ActiveContextContext'

interface BrandingContextValue {
  branding: Branding | null
  refetch: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

/** Resolves the current trainer context — ContextSwitcher's active selection for
 * multi-trainer players, or the caller's own trainerId (left to the backend to
 * derive from the JWT) for trainer/coach users — and applies `primaryColorHex` as
 * a scoped `--color-cinder` override for everything rendered inside. Re-fetches
 * whenever the active trainer changes so switching context never leaves stale
 * (or another trainer's) color applied. */
export function BrandingProvider({ children }: { children: ReactNode }): JSX.Element {
  const { selection } = useActiveContext()
  const trainerId = selection?.trainerId
  const [branding, setBranding] = useState<Branding | null>(null)

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const result = await brandingApi.get(trainerId)
      setBranding(result)
    } catch {
      // No resolvable trainer (e.g. a Player/Parent with no trainer association yet) —
      // fall back to unbranded rather than surfacing an uncaught rejection.
      setBranding(null)
    }
  }, [trainerId])

  useEffect(() => {
    let cancelled = false
    // Reset first so a slow fetch for the NEW trainer can never render with the
    // PREVIOUS trainer's colors still applied while in flight.
    setBranding(null)
    brandingApi
      .get(trainerId)
      .then((result) => {
        if (!cancelled) {
          setBranding(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranding(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [trainerId])

  const value = useMemo<BrandingContextValue>(() => ({ branding, refetch }), [branding, refetch])

  const style: CSSProperties | undefined =
    branding?.primaryColorHex !== null && branding?.primaryColorHex !== undefined
      ? ({ '--color-cinder': branding.primaryColorHex } as CSSProperties)
      : undefined

  return (
    <BrandingContext.Provider value={value}>
      <div style={style} data-testid="branding-scope">
        {children}
      </div>
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext)
  if (context === null) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return context
}
