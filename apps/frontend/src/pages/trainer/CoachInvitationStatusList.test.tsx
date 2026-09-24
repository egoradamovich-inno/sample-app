import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sharelinksApi } from '../../api/endpoints/sharelinks'
import { CoachInvitationStatusList } from './CoachInvitationStatusList'

vi.mock('../../api/endpoints/sharelinks', () => ({
  sharelinksApi: {
    generateStatic: vi.fn(),
    generateCoachInvite: vi.fn(),
    listCoachInvites: vi.fn(),
    resendCoachInvite: vi.fn(),
    resolve: vi.fn(),
    registerViaLink: vi.fn(),
  },
}))

describe('CoachInvitationStatusList', () => {
  it('should show Pending/Accepted/Expired rows with Resend visible only on Expired', async () => {
    vi.mocked(sharelinksApi.listCoachInvites).mockResolvedValue([
      { id: '1', targetEmail: 'a@example.com', status: 'PENDING', createdAt: '2026-07-01T00:00:00.000Z', expiresAt: '2026-07-08T00:00:00.000Z' },
      { id: '2', targetEmail: 'b@example.com', status: 'ACCEPTED', createdAt: '2026-07-01T00:00:00.000Z', expiresAt: '2026-07-08T00:00:00.000Z' },
      { id: '3', targetEmail: 'c@example.com', status: 'EXPIRED', createdAt: '2026-06-01T00:00:00.000Z', expiresAt: '2026-06-08T00:00:00.000Z' },
    ])

    render(<CoachInvitationStatusList />)

    expect(await screen.findByText('a@example.com')).toBeInTheDocument()
    expect(screen.getByText('b@example.com')).toBeInTheDocument()
    expect(screen.getByText('c@example.com')).toBeInTheDocument()

    const resendButtons = screen.getAllByRole('button', { name: /^resend$/i })
    expect(resendButtons).toHaveLength(1)
  })

  it('should resend the expired invite and refresh the list', async () => {
    vi.mocked(sharelinksApi.listCoachInvites)
      .mockResolvedValueOnce([
        { id: '3', targetEmail: 'c@example.com', status: 'EXPIRED', createdAt: '2026-06-01T00:00:00.000Z', expiresAt: '2026-06-08T00:00:00.000Z' },
      ])
      .mockResolvedValueOnce([
        { id: '4', targetEmail: 'c@example.com', status: 'PENDING', createdAt: '2026-07-10T00:00:00.000Z', expiresAt: '2026-07-17T00:00:00.000Z' },
      ])
    vi.mocked(sharelinksApi.resendCoachInvite).mockResolvedValue({
      code: 'NEW1',
      url: 'https://app.example/join/NEW1',
      expiresAt: '2026-07-17T00:00:00.000Z',
      targetEmail: 'c@example.com',
    })

    const user = userEvent.setup()
    render(<CoachInvitationStatusList />)

    await user.click(await screen.findByRole('button', { name: /^resend$/i }))

    await waitFor(() => expect(sharelinksApi.resendCoachInvite).toHaveBeenCalledWith('3'))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^resend$/i })).not.toBeInTheDocument())
  })
})
