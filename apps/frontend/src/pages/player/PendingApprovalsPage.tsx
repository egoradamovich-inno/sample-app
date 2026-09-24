import { useCallback, useEffect, useState } from 'react'
import type { PurchaseApproval } from '../../api/endpoints/purchase-approvals'
import { purchaseApprovalsApi } from '../../api/endpoints/purchase-approvals'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import type { StampVariant } from '../../components/ui/StampBadge'
import { StampBadge } from '../../components/ui/StampBadge'

const PAYMENT_TYPE_VARIANT: Record<PurchaseApproval['paymentType'], StampVariant> = {
  USD: 'neutral',
  TOKEN: 'pending',
}

export function PendingApprovalsPage() {
  const { user } = useAuth()
  const [approvals, setApprovals] = useState<PurchaseApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set())
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await purchaseApprovalsApi.list()
      setApprovals(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchApprovals()
  }, [fetchApprovals])

  async function handleApprove(id: string): Promise<void> {
    setMutatingId(id)
    try {
      const updated = await purchaseApprovalsApi.approve(id)
      setApprovals((current) => current.map((item) => (item.id === id ? updated : item)))
      setSettledIds((current) => new Set(current).add(id))
    } finally {
      setMutatingId(null)
    }
  }

  async function handleDeny(id: string): Promise<void> {
    setMutatingId(id)
    try {
      const updated = await purchaseApprovalsApi.deny(id)
      setApprovals((current) => current.map((item) => (item.id === id ? updated : item)))
      setSettledIds((current) => new Set(current).add(id))
    } finally {
      setMutatingId(null)
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-body text-ink-soft">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-display-lg uppercase tracking-tight text-ink">Pending Approvals</h1>

      {approvals.length === 0 ? (
        <p className="text-body text-ink-soft">No purchase approvals right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {approvals.map((approval) => {
            // Defense in depth: only the parent on the request ever sees actions,
            // even though the endpoint is already parent-scoped server-side.
            const canAct = user !== null && user.userId === approval.parentUserId

            return (
              <li
                key={approval.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rule p-4 ${
                  settledIds.has(approval.id) ? 'motion-safe:animate-[stamp-settle_220ms_ease-out] motion-reduce:animate-none' : ''
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-body text-ink">{approval.childName}</span>
                  <span className="text-body text-ink-soft">{approval.eventOrPurchaseRef}</span>
                  <span className="font-mono text-mono text-ink-soft">
                    Requested {new Date(approval.requestedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <StampBadge label={approval.paymentType} variant={PAYMENT_TYPE_VARIANT[approval.paymentType]} />
                  <StampBadge label={approval.status} variant={approval.status === 'PENDING' ? 'pending' : 'neutral'} />
                  {approval.status === 'PENDING' && canAct && (
                    <>
                      <Button onClick={() => void handleApprove(approval.id)} disabled={mutatingId === approval.id}>
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleDeny(approval.id)}
                        disabled={mutatingId === approval.id}
                      >
                        Deny
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
