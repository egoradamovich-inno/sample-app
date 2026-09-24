import { useEffect, useState } from 'react'
import type { AvailabilitySlot } from '../../api/endpoints/availability'
import { availabilityApi } from '../../api/endpoints/availability'
import { AvailabilityGrid } from '../../components/AvailabilityGrid'

/** Reuses AvailabilityGrid unchanged (generalized off a data-source prop, per
 * frontend-design-spec.md) with the "add another range" affordance already built
 * in, satisfying US-01.10's multiple-time-ranges-per-day requirement. */
export function MyTimesPage() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    availabilityApi
      .getMine()
      .then((result) => {
        if (!cancelled) {
          setSlots(result)
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
  }, [])

  async function handleSave(): Promise<void> {
    setIsSaving(true)
    setSavedMessage(null)
    try {
      const result = await availabilityApi.setMine({ slots })
      setSlots(result)
      setSavedMessage('Availability saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-display-lg uppercase tracking-tight text-ink">My Times</h1>
      {savedMessage !== null && <p className="mb-4 text-body text-status-active">{savedMessage}</p>}
      {isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <AvailabilityGrid slots={slots} onChange={setSlots} onSave={() => void handleSave()} isSaving={isSaving} />
      )}
    </main>
  )
}
