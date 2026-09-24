import { useEffect, useState } from 'react'
import type { CoachInviteListItem } from '../../api/endpoints/sharelinks'
import { sharelinksApi } from '../../api/endpoints/sharelinks'
import type { LedgerColumn } from '../../components/ui/LedgerTable'
import { LedgerTable } from '../../components/ui/LedgerTable'
import type { StampVariant } from '../../components/ui/StampBadge'
import { StampBadge } from '../../components/ui/StampBadge'

const STATUS_VARIANT: Record<CoachInviteListItem['status'], StampVariant> = {
  PENDING: 'pending',
  ACCEPTED: 'active',
  EXPIRED: 'inactive',
}

export function CoachInvitationStatusList() {
  const [items, setItems] = useState<CoachInviteListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resendingId, setResendingId] = useState<string | null>(null)

  async function fetchInvites(): Promise<void> {
    setIsLoading(true)
    try {
      const result = await sharelinksApi.listCoachInvites()
      setItems(result)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchInvites()
  }, [])

  async function handleResend(id: string): Promise<void> {
    setResendingId(id)
    try {
      await sharelinksApi.resendCoachInvite(id)
      await fetchInvites()
    } finally {
      setResendingId(null)
    }
  }

  const columns: LedgerColumn<CoachInviteListItem>[] = [
    { key: 'email', label: 'Email', render: (row) => row.targetEmail },
    { key: 'status', label: 'Status', render: (row) => <StampBadge label={row.status} variant={STATUS_VARIANT[row.status]} /> },
    {
      key: 'expires',
      label: 'Expires',
      render: (row) => <span className="font-mono text-mono">{new Date(row.expiresAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        row.status === 'EXPIRED' ? (
          <button
            type="button"
            className="text-body text-cinder underline disabled:opacity-60"
            disabled={resendingId === row.id}
            onClick={() => void handleResend(row.id)}
          >
            {resendingId === row.id ? 'Resending…' : 'Resend'}
          </button>
        ) : null,
    },
  ]

  if (isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }

  return (
    <LedgerTable
      columns={columns}
      rows={items}
      getRowKey={(row) => row.id}
      emptyMessage="No coach invitations yet."
      caption="Coach invitations"
    />
  )
}
