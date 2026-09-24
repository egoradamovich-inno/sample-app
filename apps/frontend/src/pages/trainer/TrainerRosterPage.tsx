import { useEffect, useState } from 'react'
import type { RosterMember } from '../../api/endpoints/trainer-roster'
import { trainerRosterApi } from '../../api/endpoints/trainer-roster'
import type { LedgerColumn } from '../../components/ui/LedgerTable'
import { LedgerTable } from '../../components/ui/LedgerTable'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const COLUMNS: LedgerColumn<RosterMember>[] = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'role', label: 'Role', render: (row) => row.role },
  {
    key: 'availability',
    label: 'Availability',
    render: (row) => <span className="font-mono text-mono">{row.availabilitySummary}</span>,
  },
]

/** Own-org roster only — `trainerId` scoping happens server-side from the JWT, per
 * architect-architecture.md's multi-tenancy convention; this page never accepts or
 * sends any other trainer's id. */
export function TrainerRosterPage() {
  const [members, setMembers] = useState<RosterMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterDay, setFilterDay] = useState<number | null>(null)
  const [filterTime, setFilterTime] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const request =
      filterDay !== null && filterTime !== ''
        ? trainerRosterApi.filterByAvailability(filterDay, filterTime)
        : trainerRosterApi.list().then((result) => result.items)

    request
      .then((result) => {
        if (!cancelled) {
          setMembers(result)
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
  }, [filterDay, filterTime])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-display text-display-lg uppercase tracking-tight text-ink">Roster</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DAY_LABELS.map((label, day) => (
          <button
            key={label}
            type="button"
            aria-pressed={filterDay === day}
            onClick={() => setFilterDay((current) => (current === day ? null : day))}
            className={`rounded-sm border px-3 py-1 text-label uppercase tracking-wide ${
              filterDay === day ? 'border-cinder bg-cinder-tint text-cinder' : 'border-rule-strong text-ink-soft'
            }`}
          >
            {label}
          </button>
        ))}
        <label htmlFor="roster-filter-time" className="sr-only">
          Filter by time
        </label>
        <input
          id="roster-filter-time"
          type="time"
          value={filterTime}
          onChange={(e) => setFilterTime(e.target.value)}
          className="rounded-sm border border-rule-strong bg-paper-raised px-2 py-1 font-mono text-mono text-ink"
        />
      </div>

      {isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <LedgerTable columns={COLUMNS} rows={members} getRowKey={(row) => row.id} emptyMessage="No roster members yet." caption="Roster" />
      )}
    </main>
  )
}
