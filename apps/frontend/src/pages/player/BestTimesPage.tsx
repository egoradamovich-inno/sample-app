import { useEffect, useState } from 'react'
import type { AvailabilitySlot } from '../../api/endpoints/availability'
import { availabilityApi } from '../../api/endpoints/availability'
import { AvailabilityGrid } from '../../components/AvailabilityGrid'
import { useActiveContext } from '../../nav/ActiveContextContext'

/** Scoped by ContextSwitcher's active selection — switching context re-fetches that
 * member's grid instead of a separate profile-picker duplicating the switcher. */
export function BestTimesPage() {
  const { selection } = useActiveContext()
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const activeMemberId = selection?.memberId

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    availabilityApi
      .getMine(activeMemberId)
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
  }, [activeMemberId])

  async function handleSave(): Promise<void> {
    setIsSaving(true)
    setSavedMessage(null)
    try {
      const result = await availabilityApi.setMine({ ownerProfileId: activeMemberId, slots })
      setSlots(result)
      setSavedMessage('Availability saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-display-lg uppercase tracking-tight text-ink">Best Times</h1>
      {savedMessage !== null && <p className="mb-4 text-body text-status-active">{savedMessage}</p>}
      {isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <AvailabilityGrid slots={slots} onChange={setSlots} onSave={() => void handleSave()} isSaving={isSaving} />
      )}
    </main>
  )
}
