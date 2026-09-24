import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { adminImpersonationApi } from '../../api/endpoints/admin-impersonation'
import { ImpersonationHistoryPage } from './ImpersonationHistoryPage'

vi.mock('../../api/endpoints/admin-impersonation', () => ({
  adminImpersonationApi: { history: vi.fn(), start: vi.fn(), exit: vi.fn() },
}))

describe('ImpersonationHistoryPage', () => {
  it('should render a ledger row per impersonation session', async () => {
    vi.mocked(adminImpersonationApi.history).mockResolvedValue({
      items: [
        {
          adminName: 'Ann Admin',
          targetName: 'Tom Trainer',
          startedAt: '2026-07-01T10:00:00.000Z',
          endedAt: '2026-07-01T10:05:30.000Z',
          durationSeconds: 330,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    render(<ImpersonationHistoryPage />)

    expect(await screen.findByText('Ann Admin')).toBeInTheDocument()
    expect(screen.getByText('Tom Trainer')).toBeInTheDocument()
    expect(screen.getByText('5m 30s')).toBeInTheDocument()
  })

  it('should show an empty-state message when there is no history', async () => {
    vi.mocked(adminImpersonationApi.history).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    render(<ImpersonationHistoryPage />)
    expect(await screen.findByText(/no impersonation sessions recorded/i)).toBeInTheDocument()
  })
})
