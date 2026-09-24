import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { purchaseApprovalsApi } from '../../api/endpoints/purchase-approvals'
import { PendingApprovalsPage } from './PendingApprovalsPage'

vi.mock('../../api/endpoints/purchase-approvals', () => ({
  purchaseApprovalsApi: { list: vi.fn(), approve: vi.fn(), deny: vi.fn() },
}))

const mockUseAuth = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const BASE_APPROVAL = {
  id: 'a1',
  childProfileId: 'child-1',
  childName: 'Kid One',
  eventOrPurchaseRef: 'Summer Camp',
  amount: 20,
  paymentType: 'USD' as const,
  status: 'PENDING' as const,
  isExpired: false,
  requestedAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-07-03T00:00:00.000Z',
}

describe('PendingApprovalsPage', () => {
  it('should show Approve/Deny actions when the caller is the request’s parentUserId', async () => {
    mockUseAuth.mockReturnValue({ user: { userId: 'parent-1', email: 'p@example.com', role: 'PLAYER', parentUserId: null } })
    vi.mocked(purchaseApprovalsApi.list).mockResolvedValue([{ ...BASE_APPROVAL, parentUserId: 'parent-1' }])

    render(<PendingApprovalsPage />)

    expect(await screen.findByText('Kid One')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument()
  })

  it("should hide Approve/Deny actions when the caller is not the request's parentUserId (e.g. the child themselves)", async () => {
    mockUseAuth.mockReturnValue({ user: { userId: 'child-1', email: 'kid@example.com', role: 'PLAYER', parentUserId: 'parent-1' } })
    vi.mocked(purchaseApprovalsApi.list).mockResolvedValue([{ ...BASE_APPROVAL, parentUserId: 'parent-1' }])

    render(<PendingApprovalsPage />)

    expect(await screen.findByText('Kid One')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deny/i })).not.toBeInTheDocument()
  })
})
