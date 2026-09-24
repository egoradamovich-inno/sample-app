import { useEffect, useState } from 'react'
import { adminImpersonationApi } from '../../api/endpoints/admin-impersonation'
import type { ImpersonationLogEntry } from '../../api/endpoints/admin-impersonation'
import { LedgerTable } from '../../components/ui/LedgerTable'
import type { LedgerColumn } from '../../components/ui/LedgerTable'

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return '—'
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

const COLUMNS: LedgerColumn<ImpersonationLogEntry>[] = [
  { key: 'admin', label: 'Admin', render: (row) => row.adminName },
  { key: 'target', label: 'Target', render: (row) => row.targetName },
  {
    key: 'started',
    label: 'Started',
    render: (row) => <span className="font-mono text-mono">{new Date(row.startedAt).toLocaleString()}</span>,
  },
  {
    key: 'ended',
    label: 'Ended',
    render: (row) => (
      <span className="font-mono text-mono">{row.endedAt !== null ? new Date(row.endedAt).toLocaleString() : '—'}</span>
    ),
  },
  { key: 'duration', label: 'Duration', render: (row) => <span className="font-mono text-mono">{formatDuration(row.durationSeconds)}</span> },
]

export function ImpersonationHistoryPage() {
  const [items, setItems] = useState<ImpersonationLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    adminImpersonationApi
      .history()
      .then((result) => {
        if (!cancelled) {
          setItems(result.items)
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-display text-display-lg uppercase tracking-tight text-ink">Impersonation History</h1>
      {isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <LedgerTable
          columns={COLUMNS}
          rows={items}
          getRowKey={(row, index) => `${row.adminName}-${row.targetName}-${row.startedAt}-${index}`}
          emptyMessage="No impersonation sessions recorded yet."
          caption="Impersonation history"
        />
      )}
    </main>
  )
}
