import type { AvailabilitySlot } from '../api/endpoints/availability'
import { Button } from './ui/Button'

export interface AvailabilityGridProps {
  slots: AvailabilitySlot[]
  onChange: (slots: AvailabilitySlot[]) => void
  onSave: () => void
  isSaving?: boolean
}

// Display order starts Monday (matches the "Mon 5-8pm, Wed 6-9pm" summary string
// convention); `dayOfWeek` itself stays the API's own 0 (Sun) – 6 (Sat) numbering.
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

/** Day-of-week x time-range grid — generalized off a data-source prop so both
 * BestTimesPage (players) and MyTimesPage (coaches) reuse it unchanged, per
 * frontend-design-spec.md. Supports multiple time ranges per day (US-01.10). */
export function AvailabilityGrid({ slots, onChange, onSave, isSaving = false }: AvailabilityGridProps) {
  function addRange(dayOfWeek: number): void {
    onChange([...slots, { dayOfWeek, startTime: '09:00', endTime: '10:00', isAvailable: true }])
  }

  function updateRange(index: number, patch: Partial<AvailabilitySlot>): void {
    onChange(slots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)))
  }

  function removeRange(index: number): void {
    onChange(slots.filter((_, slotIndex) => slotIndex !== index))
  }

  return (
    <div className="flex flex-col gap-6">
      {DAY_DISPLAY_ORDER.map((dayOfWeek) => {
        const daySlots = slots
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) => slot.dayOfWeek === dayOfWeek)

        return (
          <section key={dayOfWeek} className="flex flex-col gap-2">
            <h3 className="text-label uppercase tracking-wide text-ink-soft">{DAY_LABELS[dayOfWeek]}</h3>
            {daySlots.map(({ slot, index }) => (
              <div key={index} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`start-${dayOfWeek}-${index}`}>
                  {DAY_LABELS[dayOfWeek]} start time
                </label>
                <input
                  id={`start-${dayOfWeek}-${index}`}
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateRange(index, { startTime: e.target.value })}
                  className="rounded-sm border border-rule-strong bg-paper-raised px-2 py-1 font-mono text-mono text-ink"
                />
                <span className="text-body text-ink-soft">to</span>
                <label className="sr-only" htmlFor={`end-${dayOfWeek}-${index}`}>
                  {DAY_LABELS[dayOfWeek]} end time
                </label>
                <input
                  id={`end-${dayOfWeek}-${index}`}
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => updateRange(index, { endTime: e.target.value })}
                  className="rounded-sm border border-rule-strong bg-paper-raised px-2 py-1 font-mono text-mono text-ink"
                />
                <button type="button" className="text-body text-status-deleted underline" onClick={() => removeRange(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="self-start text-body text-cinder underline"
              onClick={() => addRange(dayOfWeek)}
            >
              + Add another range
            </button>
          </section>
        )
      })}

      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save availability'}
      </Button>
    </div>
  )
}
